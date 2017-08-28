/**
 * Copyright 2015-2017 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
import { assert, object } from 'laxar';
import { actions, flags } from 'laxar-patterns';

const DID_ENCOUNTER_ERROR_RESOURCE = '_DID_ENCOUNTER_ERROR_RESOURCE';

const levelMap = {
   BLANK: { weight: 0 },
   SUCCESS: { weight: 1, cssClass: 'alert alert-success' },
   INFO: { weight: 2, cssClass: 'alert alert-info' },
   WARNING: { weight: 3, cssClass: 'alert alert-warning' },
   ERROR: { weight: 4, cssClass: 'alert alert-danger' }
};
const layoutVariants = {
   1: 'list',
   2: 'flat',
   3: 'byLevel',
   4: 'separate'
};


export const injections = [ 'axContext', 'axEventBus', 'axFeatures', 'axI18n', 'axWithDom' ];
export function create( context, eventBus, features, i18n, withDom ) {

   i18n.whenLocaleChanged( rebuildMessagesForView );

   let resourceOrder = [];
   let currentStatus = null;

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   const model = {
      messageViewType: layoutVariants[ features.layout.variant ],
      messages: {},
      messagesForView: [],
      messagesForViewByLevel: {}
   };

   const commands = {
      hideMessagesByLevel( level ) {
         model.messagesForViewByLevel[ level ].forEach( commands.hideMessage );
         rebuildMessagesForView();
      },
      hideAllMessages() {
         // We need to make a copy here, as we otherwise are in conflict with the in-place modifications of
         // commands.hideMessage
         [ ...model.messagesForView ].forEach( commands.hideMessage );
         render();
      },
      hideMessage( message ) {
         const index = model.messagesForView.indexOf( message );
         if( index !== -1 ) {
            message.sourceMessages.forEach( sourceMessage => {
               sourceMessage.dismissed = true;
            } );
            model.messagesForView.splice( index, 1 );
         }
         render();
      }
   };

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   actions.handlerFor( context ).registerActionsFromFeature( 'status.reset', () => {
      changeLevelStatus( 'BLANK' );
      model.messages = {};
      rebuildMessagesForView();
      recalculateCurrentStatus();
   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   if( Array.isArray( features.resource.list ) ) {
      if( features.resource.list.length === 0 ) {
         eventBus.subscribe( 'didValidate', insertMessagesForEvent );
      }
      else {
         resourceOrder = [ ...features.resource.list ];
         features.resource.list.forEach( resource => {
            eventBus.subscribe( `didValidate.${resource}`, insertMessagesForEvent );
         } );
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   if( features.errors.enabled ) {
      eventBus.subscribe( 'didEncounterError', event => {
         insertMessagesForEvent( {
            resource: DID_ENCOUNTER_ERROR_RESOURCE,
            data: [ {
               level: 'ERROR',
               htmlMessage: event.message
            } ]
         } );
      } );
   }

   changeLevelStatus( 'BLANK' );

   return {
      onDomAvailable() {
         withDom( render );
      }
   };

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function insertMessagesForEvent( event ) {
      const topic = event.resource;
      if( features.resource.exclude && features.resource.exclude.some( isSuperTopicOf( topic ) ) ) {
         return;
      }

      if( topic ) {
         const [ superTopic ] = topic.split( /-/ );
         clearMessagesOn( `validateRequest.${superTopic}`, topic );
         clearMessagesOn( `didReplace.${superTopic}`, topic );
      }

      if( features.resource.replace && event.outcome === 'SUCCESS' ) {
         if( model.messages[ topic ] ) {
            model.messages[ topic ].length = 0;
         }
      }

      const messageBucket = model.messages;
      if( !Array.isArray( messageBucket[ topic ] ) ) {
         messageBucket[ topic ] = [];
         if( resourceOrder.indexOf( topic ) === -1 ) {
            // In case of catch-all resource configuration, resources are simply ordered by the order
            // messages for them arrive.
            resourceOrder.push( topic );
         }
      }

      ( event.data || [] ).forEach( message => {
         if( !( 'sortKey' in message ) ) {
            message.sortKey = '000';
         }
         messageBucket[ topic ].push( message );
      } );

      rebuildMessagesForView();
      recalculateCurrentStatus();
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function isSuperTopicOf( subTopic ) {
      return superTopic => {
         return subTopic === superTopic || (
            subTopic.charAt( superTopic.length ) === '-' && subTopic.indexOf( superTopic ) === 0
         );
      };
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function clearMessagesOn( eventName, topic ) {
      const unsubscribe = eventBus.subscribe( eventName, () => {
         if( Array.isArray( model.messages[ topic ] ) ) {
            model.messages[ topic ].length = 0;
            rebuildMessagesForView();
            recalculateCurrentStatus();
         }
         unsubscribe();
      } );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function rebuildMessagesForView() {
      const messagesForView = [];
      const textToPosition = {};

      resourceOrder.forEach( resource => {
         const resourceMessages = [ ...object.path( model.messages, resource, [] ) ];

         // eslint-disable-next-line no-nested-ternary
         resourceMessages.sort( ( a, b ) => a.sortKey < b.sortKey ? -1 : ( a.sortKey > b.sortKey ? 1 : 0 ) );
         resourceMessages.forEach( message => {
            if( message.dismissed ) {
               return;
            }

            const viewMessage = transformMessageForView( message );
            if( viewMessage.htmlText in textToPosition ) {
               const existingMessage = messagesForView[ textToPosition[ viewMessage.htmlText ] ];
               const sourceMessages = [ ...existingMessage.sourceMessages, ...viewMessage.sourceMessages ];
               if( levelMap[ existingMessage.level ].weight < levelMap[ viewMessage.level ].weight ) {
                  viewMessage.sourceMessages = sourceMessages;
                  messagesForView[ textToPosition[ viewMessage.htmlText ] ] = viewMessage;
               }
               else {
                  existingMessage.sourceMessages = sourceMessages;
               }
               return;
            }

            textToPosition[ viewMessage.htmlText ] = messagesForView.length;
            messagesForView.push( viewMessage );
         } );
      } );

      model.messagesForView = messagesForView;

      if( model.messageViewType === 'byLevel' ) {
         const messagesForViewByLevel = {};
         Object.keys( levelMap ).forEach( level => {
            messagesForViewByLevel[ level ] = messagesForView.filter( message => message.level === level );
         } );
         model.messagesForViewByLevel = messagesForViewByLevel;
      }

      render();
      scrollWidgetIntoView();
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function render() {
      withDom( element => {
         element.innerHTML = '';
         if( model.messagesForView.length <= 0 ) {
            return;
         }

         let layoutElement;
         switch( model.messageViewType ) {
            case 'list': {
               layoutElement = document.createElement( 'ul' );
               layoutElement.className = 'ax-local-list ax-local-flat-list ax-local-without-frame';
               model.messagesForView.forEach( message => {
                  const listItem = document.createElement( 'li' );
                  listItem.className = message.cssClass;
                  listItem.innerHTML = message.htmlText;
                  layoutElement.appendChild( listItem );
               } );
               break;
            }

            case 'flat': {
               layoutElement = document.createElement( 'div' );
               layoutElement.className = 'alert ax-local-flat';
               if( features.dismiss.enabled ) {
                  const dismissButton = document.createElement( 'button' );
                  dismissButton.type = 'button';
                  dismissButton.className = 'close';
                  dismissButton.addEventListener( 'click', commands.hideAllMessages, false );
                  layoutElement.appendChild( dismissButton );
               }

               const listNode = document.createElement( 'ul' );
               listNode.className = 'ax-local-list ax-local-flat-list';
               layoutElement.appendChild( listNode );

               model.messagesForView.forEach( message => {
                  const listItem = document.createElement( 'li' );
                  listItem.className = message.cssClass;
                  listItem.innerHTML = message.htmlText;
                  listNode.appendChild( listItem );
               } );
               break;
            }

            case 'byLevel': {
               layoutElement = document.createElement( 'div' );
               Object.keys( levelMap ).forEach( level => {
                  if( model.messagesForViewByLevel[ level ].length <= 0 ) {
                     return;
                  }

                  const levelInfo = levelMap[ level ];
                  const levelWrapper = document.createElement( 'div' );
                  levelWrapper.className = levelInfo.cssClass;
                  layoutElement.appendChild( levelWrapper );

                  const dismissButton = document.createElement( 'button' );
                  dismissButton.type = 'button';
                  dismissButton.className = 'close';
                  dismissButton.addEventListener(
                     'click', commands.hideMessagesByLevel.bind( null, level ), false
                  );
                  levelWrapper.appendChild( dismissButton );

                  const listNode = document.createElement( 'ul' );
                  listNode.className = 'ax-local-list';
                  levelWrapper.appendChild( listNode );

                  model.messagesForViewByLevel[ level ].forEach( message => {
                     const listItem = document.createElement( 'li' );
                     listItem.innerHTML = `<span>${message.htmlText}</span>`;
                     listNode.appendChild( listItem );
                  } );
               } );
               break;
            }

            case 'separate': {
               layoutElement = document.createElement( 'div' );
               layoutElement.className = 'ax-local-separate';
               model.messagesForView.forEach( message => {
                  const item = document.createElement( 'div' );
                  item.className = message.cssClass;
                  layoutElement.appendChild( item );

                  const dismissButton = document.createElement( 'button' );
                  dismissButton.type = 'button';
                  dismissButton.className = 'close';
                  dismissButton.addEventListener(
                     'click', commands.hideMessage.bind( null, message ), false
                  );
                  item.appendChild( dismissButton );

                  const messageWrapper = document.createElement( 'div' );
                  messageWrapper.innerHTML = message.htmlText;
                  item.appendChild( messageWrapper );
               } );
               break;
            }

            default:
               assert.codeIsUnreachable( `Unsupported message view type "${model.messageViewType}".` );
               return;
         }

         element.appendChild( layoutElement );
      } );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function transformMessageForView( message ) {
      return {
         htmlText: i18n.localize( message.i18nHtmlMessage || message.htmlMessage ),
         level: message.level,
         cssClass: levelMap[ message.level ].cssClass,
         sourceMessages: [ message ]
      };
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function recalculateCurrentStatus() {
      let newStatus = 'BLANK';
      Object.keys( model.messages ).forEach( resource => {
         model.messages[ resource ].forEach( message => {
            if( levelMap[ message.level ].weight > levelMap[ newStatus ].weight ) {
               newStatus = message.level;
            }
         } );
      } );
      changeLevelStatus( newStatus );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function changeLevelStatus( newStatus ) {
      if( newStatus === currentStatus ) { return; }

      if( currentStatus != null ) {
         flags.publisherForFeature( context, `status.${currentStatus}`, { optional: true } )( false );
      }

      flags.publisherForFeature( context, `status.${newStatus}`, { optional: true } )( true );
      currentStatus = newStatus;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function scrollWidgetIntoView() {
      if( !features.autoScroll.enabled ) {
         return;
      }

      setTimeout( () => {
         withDom( element => {
            element.scrollIntoView( true );
         } );
      }, 0 );
   }
}
