/**
 * Copyright 2015-2017 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
import * as ng from 'angular';
import 'angular-sanitize';
import { object } from 'laxar';
import { flags } from 'laxar-patterns';

const DID_ENCOUNTER_ERROR_RESOURCE = '_DID_ENCOUNTER_ERROR_RESOURCE';
const EVENT_SCROLL_TO_MESSAGES = 'axMessagesWidget.scrollToMessages';

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

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

Controller.$inject = [ '$scope', 'axFeatures', 'axI18n' ];

function Controller( $scope, features, i18n ) {

   i18n.whenLocaleChanged( rebuildMessagesForView );

   let resourceOrder = [];
   let currentStatus = null;
   const resources = features.resource.list;
   const exclusions = features.resource.exclude;

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   $scope.model = {
      levelMap,
      messageViewType: layoutVariants[ features.layout.variant ],
      messages: {},
      messagesForView: [],
      messagesForViewByLevel: {}
   };

   $scope.actions = {
      hideMessagesByLevel( level ) {
         $scope.model.messagesForViewByLevel[ level ].forEach( $scope.actions.hideMessage );
         // update messages by level
         rebuildMessagesForView();
      },
      hideAllMessages() {
         // We need to make a copy here, as we otherwise are in conflict with the in-place modifications of
         // $scope.model.hideMessage
         $scope.model.messagesForView.slice( 0 ).forEach( $scope.actions.hideMessage );
      },
      hideMessage( message ) {
         const index = $scope.model.messagesForView.indexOf( message );
         if( index !== -1 ) {
            message.sourceMessages.forEach( sourceMessage => {
               sourceMessage.dismissed = true;
            } );
            $scope.model.messagesForView.splice( index, 1 );
         }
      }
   };

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   if( Array.isArray( resources ) ) {
      if( resources.length === 0 ) {
         $scope.eventBus.subscribe( 'didValidate', insertMessagesForEvent );
      }
      else {
         resourceOrder = resources.slice( 0 );
         resources.forEach( resource => {
            $scope.eventBus.subscribe( `didValidate.${resource}`, insertMessagesForEvent );
         } );
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   if( features.errors.enabled ) {
      $scope.eventBus.subscribe( 'didEncounterError', event => {
         insertMessagesForEvent( {
            resource: DID_ENCOUNTER_ERROR_RESOURCE,
            data: [ {
               level: 'ERROR',
               htmlMessage: event.message
            } ]
         } );
      } );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   if( features.status.reset && features.status.reset.onActions ) {
      const actions = features.status.reset.onActions;

      actions.forEach( action => {
         $scope.eventBus.subscribe( `takeActionRequest.${action}`, event => {
            $scope.eventBus.publish( `willTakeAction.${event.action}`, {
               action: event.action
            } );
            changeLevelStatus( 'BLANK' );
            $scope.model.messages = {};
            rebuildMessagesForView();
            recalculateCurrentStatus();
            $scope.eventBus.publish( `didTakeAction.${event.action}`, {
               action: event.action
            } );
         } );
      } );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   changeLevelStatus( 'BLANK' );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function insertMessagesForEvent( event ) {
      const topic = event.resource;
      if( exclusions && exclusions.some( isSuperTopicOf( topic ) ) ) {
         return;
      }

      if( topic ) {
         const [ superTopic ] = topic.split( /-/ );
         clearMessagesOn( `validateRequest.${superTopic}`, topic );
         clearMessagesOn( `didReplace.${superTopic}`, topic );
      }

      if( features.resource.replace && event.outcome === 'SUCCESS' ) {
         if( $scope.model.messages[ topic ] ) {
            $scope.model.messages[ topic ].length = 0;
         }
      }

      const messageBucket = $scope.model.messages;
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
      const unsubscribe = $scope.eventBus.subscribe( eventName, () => {
         const messageBucket = $scope.model.messages;
         if( Array.isArray( messageBucket[ topic ] ) ) {
            messageBucket[ topic ].length = 0;
            rebuildMessagesForView();
            recalculateCurrentStatus();
         }
         unsubscribe();
      } );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function rebuildMessagesForView() {
      const model = $scope.model;
      const messagesForView = [];
      const textToPosition = {};

      resourceOrder.forEach( resource => {
         const resourceMessages = object.path( model.messages, resource, [] ).slice( 0 );

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

      $scope.model.messagesForView = messagesForView;

      if( model.messageViewType === 'byLevel' ) {
         const messagesForViewByLevel = {};
         Object.keys( model.levelMap ).forEach( level => {
            messagesForViewByLevel[ level ] = messagesForView.filter( message => message.level === level );
         } );
         model.messagesForViewByLevel = messagesForViewByLevel;
      }
      scrollWidgetIntoView();
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
      Object.keys( $scope.model.messages ).forEach( resource => {
         $scope.model.messages[ resource ].forEach( message => {
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
         flags.publisherForFeature( $scope, `status.${currentStatus}`, { optional: true } )( false );
      }

      flags.publisherForFeature( $scope, `status.${newStatus}`, { optional: true } )( true );
      currentStatus = newStatus;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function scrollWidgetIntoView() {
      if( !features.autoScroll.enabled ) {
         return;
      }
      // in case the are no messages yet, we set a timeout to ensure that the directive
      // axMessagesAutoScroll has registered to the event and is not still blocked by the ngIf
      setTimeout( () => {
         $scope.$broadcast( EVENT_SCROLL_TO_MESSAGES );
      }, 0 );
   }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

const autoScrollDirectiveName = 'axMessagesAutoScroll';
const autoScrollDirective = [ () => {
   return {
      link( $scope, $element ) {
         if( $scope.features.autoScroll.enabled ) {
            $scope.$on( EVENT_SCROLL_TO_MESSAGES, () => {
               setTimeout( () => {
                  $element[ 0 ].scrollIntoView( true );
               }, 0 );
            } );
         }
      }
   };
} ];

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const name = ng.module( 'axMessagesWidget', [ 'ngSanitize' ] )
   .controller( 'AxMessagesWidgetController', Controller )
   .directive( autoScrollDirectiveName, autoScrollDirective ).name;
