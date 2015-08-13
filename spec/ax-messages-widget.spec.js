/**
 * Copyright 2015 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
define( [
   'json!../widget.json',
   '../ax-messages-widget',
   'laxar/laxar_testing',
   'angular-mocks',
   'jquery',
   './spec_data',
   'text!../default.theme/ax-messages-widget.html',
   'angular-sanitize'
], function( descriptor, controller, ax, angularMocks, $, specData, template ) {
   'use strict';

   describe( 'An ax-messages-widget', function() {

      var ANY_FUNCTION = jasmine.any( Function );

      var $container;
      var $wrapper;
      var testBed;
      var eventBus;
      var scopeEventBus;
      var data;

      beforeEach( function setup() {
         angularMocks.module( 'ngSanitize' );

         testBed = ax.testing.portalMocksAngular.createControllerTestBed( descriptor );
         testBed.useWidgetJson();
         setupWithFeatures( { resource: { list: [] } } );

         data = ax.object.deepClone( specData );

         $container = $( '<div id="container"></div>' ).appendTo( 'body' );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      afterEach( function() {
         testBed.tearDown();
         $container.remove();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with a configured feature messages', function() {

         it( 'interprets and displays received messages as HTML content (R1.1)', function() {
            setupWithFeatures( { resource: { list: [] } } );
            publishDidValidateEvents( [
               {
                  resource: 'myResource',
                  outcome:  'ERROR',
                  data: [
                     {
                        htmlMessage: '<b>Wrong</b> car',
                        level: 'ERROR',
                        sortKey: '010'
                     }
                  ]
               }
            ] );
            expect( testBed.scope.model.messagesForView[0].htmlText ).toEqual( '<b>Wrong</b> car' );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'shows the appropriate list types for each variant (R1.2)', function() {
            var variants = { 1: 'list', 2: 'flat', 3: 'byLevel', 4: 'separate' };

            for( var variant = 1; variant <= 4; ++variant ) {
               setupWithFeatures( { layout: { variant: variant }, resource: { list: [] } } );
               publishDidValidateEvents( [ data.cssClassTestEvent ] );
               renderWidget();
               expect( $wrapper.children( 0 ).attr( 'data-ng-switch-when' ) ).toEqual( variants[ variant ] );
               $container.children().remove();
            }
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'sets the css class of the border to the one of the error class (R1.3)', function() {
            setupWithFeatures( {  resource: { list: [] } } );
            publishDidValidateEvents( [ data.cssClassTestEvent ] );
            renderWidget();
            expect( $( '.alert-danger' ).length ).toEqual( 1 );
            expect( $( '.alert-success' ).length ).toEqual( 1 );
            expect( $( '.alert-warning' ).length ).toEqual( 1 );
            expect( $( '.alert-info' ).length ).toEqual( 1 );
            $container.children().remove();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'assigns css classes according to message level (A1.4)', function() {
            publishDidValidateEvents( [ data.cssClassTestEvent ] );

            var viewMessages = testBed.scope.model.messagesForView;
            expect( viewMessages.length ).toBe( 4 );
            expect( viewMessages[0].cssClass ).toEqual( 'alert alert-danger' );
            expect( viewMessages[1].cssClass ).toEqual( 'alert alert-success' );
            expect( viewMessages[2].cssClass ).toEqual( 'alert alert-warning' );
            expect( viewMessages[3].cssClass ).toEqual( 'alert alert-info' );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'saves the error class, html content and sort key of each message (R1.5)', function() {
            publishDidValidateEvents( [ data.cssClassTestEvent ] );
            for( var i = 0; i < testBed.scope.model.messagesForView.length; ++i ) {
               expect( testBed.scope.model.messages.something[ i ].level ).toBeDefined();
               expect( testBed.scope.model.messages.something[ i ].sortKey ).toBeDefined();
               expect( testBed.scope.model.messages.something[ i ].htmlMessage ).toBeDefined();
            }
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'when messages were received', function() {

            beforeEach( function() {
               setupWithFeatures( { resource: { list: [ 'pet', 'beverage', 'car' ] } } );

               publishDidValidateEvents( data.simpleMessages.car );
               publishDidValidateEvents( data.simpleMessages.pet );
               publishDidValidateEvents( data.simpleMessages.beverage );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'puts these messages into a single view list (R1.6)', function() {
               expect( testBed.scope.model.messagesForView.length ).toBe( 5 );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'sorts the messages by configured resources and for each resource by sortKey (R1.7)', function() {
               var viewMessages = testBed.scope.model.messagesForView;

               expect( viewMessages.length ).toBe( 5 );
               expect( viewMessages[ 0 ].htmlText ).toEqual( 'No hamster' );
               expect( viewMessages[ 1 ].htmlText ).toEqual( 'Hamster is hungry' );
               expect( viewMessages[ 2 ].htmlText ).toEqual( 'Too expensive' );
               expect( viewMessages[ 3 ].htmlText ).toEqual( 'Strange color' );
               expect( viewMessages[ 4 ].htmlText ).toEqual( 'Wrong car' );
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'when multiple messages with same text are received', function() {

            beforeEach( function() {
               setupWithFeatures( { resource: { list: [ 'car', 'beverage', 'car2', 'beverage2' ] } } );

               publishDidValidateEvents( data.simpleMessages.car );
               publishDidValidateEvents( data.simpleMessages.car2 );
               publishDidValidateEvents( data.simpleMessages.beverage );
               publishDidValidateEvents( data.simpleMessages.beverage2 );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'those messages are merged using the highest level at the first position the message occurred (R1.8, R1.9)', function() {
               var viewMessages = testBed.scope.model.messagesForView;

               expect( viewMessages.length ).toBe( 3 );
               expect( viewMessages[ 0 ].htmlText ).toEqual( 'Strange color' );
               expect( viewMessages[ 0 ].level ).toEqual( 'ERROR' );
               expect( viewMessages[ 1 ].htmlText ).toEqual( 'Wrong car' );
               expect( viewMessages[ 1 ].level ).toEqual( 'ERROR' );
               expect( viewMessages[ 2 ].htmlText ).toEqual( 'Too expensive' );
               expect( viewMessages[ 2 ].level ).toEqual( 'WARNING' );
            } );
         } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with feature dismiss', function() {

         describe( 'when the feature is disabled', function() {

            beforeEach( function() {
               setupWithFeatures( {
                  resource: { list: [ 'beverage' ] },
                  dismiss: { enabled: false },
                  layout: { variant: 2 }
               } );
               publishDidValidateEvents( data.simpleMessages.beverage );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'there is no visible button to dismiss a message (R2.1)', function() {
               var hideButton = $( renderWidget() ).find( 'button' );
               expect( hideButton.length ).toBe( 1 );
               expect( hideButton.css( 'display' ) ).toEqual( 'none' );
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'when the feature is enabled', function() {

            beforeEach( function() {
               setupWithFeatures( {
                  resource: { list: [ 'beverage' ] },
                  dismiss: { enabled: true },
                  layout: { variant: 2 }
               } );
               publishDidValidateEvents( data.simpleMessages.beverage );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'there is a visible button to dismiss a message (R2.2)', function() {
               var hideButton = renderWidget().find( 'button' );
               expect( hideButton.length ).toBe( 1 );
               expect( hideButton.css( 'display' ) ).not.toEqual( 'none' );
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'when the feature is enabled for variant 1 (no alert)', function() {

            beforeEach( function() {
               setupWithFeatures( {
                  resource: { list: [ 'beverage', 'car' ] },
                  dismiss: { enabled: true },
                  layout: { variant: 1 }
               } );
               publishDidValidateEvents( data.simpleMessages.beverage );
               publishDidValidateEvents( data.simpleMessages.car );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'there is no visible dismiss button (R2.3)', function() {
               var hideButton = renderWidget().find( 'button:visible' );

               expect( hideButton.length ).toBe( 0 );
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'when the feature is enabled for variant 2 (one alert for all messages)', function() {

            beforeEach( function() {
               setupWithFeatures( {
                  resource: { list: [ 'beverage', 'car' ] },
                  dismiss: { enabled: true },
                  layout: { variant: 2 }
               } );
               publishDidValidateEvents( data.simpleMessages.beverage );
               publishDidValidateEvents( data.simpleMessages.car );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'all messages can be deleted together (R2.3)', function() {
               expect( testBed.scope.model.messagesForView.length ).toBe( 3 );
               testBed.scope.actions.hideAllMessages();
               expect( testBed.scope.model.messagesForView.length ).toBe( 0 );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'there is only one visible dismiss button deleting all messages (R2.3)', function() {
               var hideButton = renderWidget().find( 'button:visible' );

               expect( hideButton.length ).toBe( 1 );
               expect( testBed.scope.model.messagesForView.length ).toBe( 3 );
               hideButton.eq( 0 ).click();
               expect( testBed.scope.model.messagesForView.length ).toBe( 0 );
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'when the feature is enabled for variant 3 (one alert per error class)', function() {

            beforeEach( function() {
               setupWithFeatures( {
                  resource: { list: [ 'beverage', 'car' ] },
                  dismiss: { enabled: true },
                  layout: { variant: 3 }
               } );
               publishDidValidateEvents( data.simpleMessages.beverage );
               publishDidValidateEvents( data.simpleMessages.car );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'each message receives a visible dismiss button (R2.3)', function() {
               var dom = renderWidget();
               expect( dom.find( '.alert button.close:visible' ).length ).toBe( 2 );
               expect( testBed.scope.model.messagesForView.length ).toBe( 3 );
               dom.find( '.alert-danger button.close' ).click();
               testBed.scope.$apply();
               expect( testBed.scope.model.messagesForView.length ).toBe( 2 );
               dom.find( '.alert-warning button.close' ).click();
               expect( testBed.scope.model.messagesForView.length ).toBe( 0 );
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'when the feature is enabled for variant 4 (one alert per message)', function() {

            beforeEach( function() {
               setupWithFeatures( {
                  resource: { list: [ 'beverage', 'car' ] },
                  dismiss: { enabled: true },
                  layout: { variant: 4 }
               } );
               publishDidValidateEvents( data.simpleMessages.beverage );
               publishDidValidateEvents( data.simpleMessages.car );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'each message receives a visible dismiss button (R2.3)', function() {
               var hideButton = renderWidget().find( 'button:visible' );

               expect( hideButton.length ).toBe( 3 );
               expect( testBed.scope.model.messagesForView.length ).toBe( 3 );
               hideButton.eq( 0 ).click();
               expect( testBed.scope.model.messagesForView.length ).toBe( 2 );
               hideButton.eq( 1 ).click();
               expect( testBed.scope.model.messagesForView.length ).toBe( 1 );
               hideButton.eq( 2 ).click();
               expect( testBed.scope.model.messagesForView.length ).toBe( 0 );
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'when the feature is enabled and the level changes on dismiss', function() {

            beforeEach( function() {
               setupWithFeatures( {
                  resource: { list: [ 'pet' ] },
                  dismiss: { enabled: true },
                  layout: { variant: 3 }
               } );
               publishDidValidateEvents( data.simpleMessages.pet );

               scopeEventBus.publish.reset();

               testBed.scope.$apply( function() {
                  testBed.scope.actions.hideMessagesByLevel( 'ERROR' );
               } );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'the internal status does not change to a lower level (R2.4)', function() {
               expect( scopeEventBus.publish ).not.toHaveBeenCalledWith( 'didChangeFlag.messageStatus-INFO.true', {
                  flag: 'messageStatus-INFO',
                  state: true
               } );
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'when there are dismissed messages and new messages arrive', function() {

            var $element_;

            beforeEach( function() {
               setupWithFeatures( {
                  resource: { list: [ 'beverage', 'car' ] },
                  dismiss: { enabled: true },
                  layout: { variant: 4 }
               } );

               $element_ = renderWidget();
               publishDidValidateEvents( data.simpleMessages.beverage );

               $element_.find( 'button:visible:first' ).click();
               publishDidValidateEvents( data.simpleMessages.car );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'those will be displayed (R2.5)', function() {
               var messages = [];
               $element_.find( '[data-ng-bind-html="message.htmlText"]' ).each( function() {
                  messages.push( $( this ).text() );
               } );

               expect( messages ).toContain( data.simpleMessages.car[0].data[0].htmlMessage.en_US );
               expect( messages ).toContain( data.simpleMessages.car[0].data[1].htmlMessage.en_US );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'dismissed will remain hidden (R2.5)', function() {
               var messages = [];
               $element_.find( '[data-ng-bind-html="message.htmlText"]' ).each( function() {
                  messages.push( $( this ).text() );
               } );

               expect( messages ).not.toContain( data.simpleMessages.beverage[0].data[0].htmlMessage.en_US );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            describe( 'when dismissed messages get renewed by didValidate events', function() {

               beforeEach( function() {
                  publishDidValidateEvents( data.simpleMessages.beverage );
               } );

               ///////////////////////////////////////////////////////////////////////////////////////////////

               it( 'they will be displayed again (R2.5)', function() {
                  var messages = [];
                  $element_.find( '[data-ng-bind-html="message.htmlText"]' ).each( function() {
                     messages.push( $( this ).text() );
                  } );

                  expect( messages ).toContain( data.simpleMessages.car[ 0 ].data[ 0 ].htmlMessage.en_US );
                  expect( messages ).toContain( data.simpleMessages.car[ 0 ].data[ 1 ].htmlMessage.en_US );
                  expect( messages ).toContain( data.simpleMessages.beverage[ 0 ].data[ 0 ].htmlMessage.en_US );
               } );
            } );
         } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with feature blank', function() {

         it( 'when there are no messages the widget is invisible (R3.1)', function() {
            expect( renderWidget().children().length ).toBe( 0 );
         } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with feature status', function() {

         beforeEach( function() {
            setupWithFeatures( { resource: { list: [ 'allLevels' ] } } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'sends a state flag with BLANK when there initially is no message (R4.1, R4.3)', function() {
            expect( scopeEventBus.publish ).toHaveBeenCalledWith( 'didChangeFlag.messageStatus-BLANK.true', {
               flag: 'messageStatus-BLANK',
               state: true
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'sends a state flag for the highest level using the default flag name without further configuration (R4.1, R4.3, R4.5)', function() {
            var levels = [ 'ERROR', 'WARNING', 'INFO', 'SUCCESS' ];
            for( var i = 0; i < levels.length; ++i ) {
               setupWithFeatures( { resource: { list: [ 'allLevels' ] } } );
               publishDidValidateEvents( data.allLevelEvents.slice( i ) );
               var flagName = 'messageStatus-' + levels[ i ];

               expect( scopeEventBus.publish ).toHaveBeenCalledWith( 'didChangeFlag.' + flagName + '.true', {
                  flag: flagName,
                  state: true
               } );
            }
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'sends a state flag for the highest level using the configured flag name (R4.1, R4.2, R4.3)', function() {
            var levels = [ 'ERROR', 'WARNING', 'INFO', 'SUCCESS' ];
            for( var i = 0; i < levels.length; ++i ) {
               var flagName = 'myFlag' + i;
               var statusConfig = {};
               statusConfig[ levels[ i ] ] = flagName;

               setupWithFeatures( {
                  resource: { list: [ 'allLevels' ] },
                  status: statusConfig
               } );
               publishDidValidateEvents( data.allLevelEvents.slice( i ) );

               expect( scopeEventBus.publish ).toHaveBeenCalledWith( 'didChangeFlag.' + flagName + '.true', {
                  flag: flagName,
                  state: true
               } );
            }
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'sends a flag with state false for the previous state (R4.4)', function() {
            setupWithFeatures( { resource: { list: [ 'allLevels' ] } } );
            expect( scopeEventBus.publish ).toHaveBeenCalledWith( 'didChangeFlag.messageStatus-BLANK.true', {
               flag: 'messageStatus-BLANK',
               state: true
            } );

            scopeEventBus.publish.reset();
            publishDidValidateEvents( data.allLevelEvents.slice( 0, 1 ) );
            expect( scopeEventBus.publish ).toHaveBeenCalledWith( 'didChangeFlag.messageStatus-BLANK.false', {
               flag: 'messageStatus-BLANK',
               state: false
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'sets the state to BLANK and deletes all messages if a configured action is triggured (R4.6)', function () {
            var features = {
               status: {
                  reset: {
                     onActions: [ 'resetMessages' ]
                  }
               },
               resource: {
                  list: [ 'allLevels' ]
               }
            };
            setupWithFeatures( features );
            publishDidValidateEvents( data.allLevelEvents.slice( 0 ) );

            expect( testBed.scope.model.messagesForView.length ).toBe( 4 );

            expect( scopeEventBus.publish ).toHaveBeenCalledWith( 'didChangeFlag.messageStatus-ERROR.true', {
               flag: 'messageStatus-ERROR',
               state: true
            } );

            scopeEventBus.publish.reset();
            eventBus.publish( 'takeActionRequest.resetMessages', {
               action: 'resetMessages'
            } );
            jasmine.Clock.tick( 0 );

            expect( scopeEventBus.publish ).
               toHaveBeenCalledWith( 'willTakeAction.resetMessages', {
                  action: 'resetMessages'
               }
            );
            expect( scopeEventBus.publish ).toHaveBeenCalledWith( 'didChangeFlag.messageStatus-BLANK.true', {
               flag: 'messageStatus-BLANK',
               state: true
            } );
            expect( scopeEventBus.publish ).
               toHaveBeenCalledWith( 'didTakeAction.resetMessages', {
                  action: 'resetMessages'
               }
            );
            expect( testBed.scope.model.messagesForView.length ).toBe( 0 );
         } );

      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with feature resource', function() {

         describe( 'if resource list is null', function() {

            beforeEach( function() {
               setupWithFeatures( { resource: { list: null } } );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'the feature is completely disabled (R5.1)', function() {
               var unexpectedCalls = scopeEventBus.subscribe.calls.reduce( function( collectedCalls, call ) {
                  return call.args[ 0 ].match( /^didValidate|^didReplace|^validateRequest/ ) ?
                     collectedCalls.concat( [ call.args[ 0 ] ] ) : collectedCalls;
               }, [] );

               expect( unexpectedCalls ).toEqual( [] );
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'if resource list is empty', function() {

            beforeEach( function() {
               setupWithFeatures( { resource: { list: [] } } );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'all resources are validated (R5.2)', function() {
               expect( scopeEventBus.subscribe ).toHaveBeenCalledWith( 'didValidate', ANY_FUNCTION );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            describe( 'when messages are received', function() {

               beforeEach( function() {
                  publishDidValidateEvents( data.simpleMessages.car );
                  publishDidValidateEvents( data.simpleMessages.pet );
                  publishDidValidateEvents( data.simpleMessages.beverage );
               } );

               //////////////////////////////////////////////////////////////////////////////////////////////////

               it( 'all messages are inserted into the respective lists (R5.3, R5.6)', function() {
                  expect( testBed.scope.model.messages.car )
                     .toEqual( data.simpleMessages.car[ 0 ].data );
                  expect( testBed.scope.model.messages.pet )
                     .toEqual( [ data.simpleMessages.pet[ 0 ].data[ 0 ], data.simpleMessages.pet[ 1 ].data[ 0 ] ] );
                  expect( testBed.scope.model.messages.beverage )
                     .toEqual( data.simpleMessages.beverage[ 0 ].data );
               } );

               ///////////////////////////////////////////////////////////////////////////////////////////////

               it( 'messages are deleted again for didReplace of a certain resource (R5.4)', function() {
                  publishDidReplaceEvents( [ { resource: 'pet', data: {} } ] );
                  publishDidReplaceEvents( [ { resource: 'beverage', data: {} } ] );

                  expect( testBed.scope.model.messages.car )
                     .toEqual( data.simpleMessages.car[ 0 ].data );
                  expect( testBed.scope.model.messages.pet ) .toEqual( [] );
                  expect( testBed.scope.model.messages.beverage ) .toEqual( [] );

                  expect( testBed.scope.model.messagesForView.length ).toBe( 2 );
               } );

               ///////////////////////////////////////////////////////////////////////////////////////////////

               it( 'messages are deleted again for validateRequest of a certain resource (R5.4)', function() {
                  eventBus.publish( 'validateRequest.pet', { resource: 'pet' } );
                  eventBus.publish( 'validateRequest.beverage', { resource: 'beverage' } );
                  jasmine.Clock.tick( 0 );

                  expect( testBed.scope.model.messages.car )
                     .toEqual( data.simpleMessages.car[ 0 ].data );
                  expect( testBed.scope.model.messages.pet ) .toEqual( [] );
                  expect( testBed.scope.model.messages.beverage ) .toEqual( [] );

                  expect( testBed.scope.model.messagesForView.length ).toBe( 2 );
               } );

               ///////////////////////////////////////////////////////////////////////////////////////////////

               it( 'messages for sub-topics are deleted on validateRequest of a super-topic resource (R5.5)', function() {
                  publishDidValidateEvents( data.subMessages[ 'pet-health' ] );
                  jasmine.Clock.tick( 0 );
                  expect( testBed.scope.model.messages[ 'pet-health' ] )
                     .toEqual( data.subMessages[ 'pet-health' ][ 0 ].data );
                  expect( testBed.scope.model.messagesForView.length ).toBe( 6 );

                  eventBus.publish( 'validateRequest.pet', { resource: 'pet' } );
                  jasmine.Clock.tick( 0 );
                  expect( testBed.scope.model.messages[ 'pet-health' ] ) .toEqual( [] );
                  expect( testBed.scope.model.messagesForView.length ).toBe( 3 );
               } );

               ///////////////////////////////////////////////////////////////////////////////////////////////

               it( 'messages are not deleted again for SUCCESS message of a certain resource (replace is false) (R5.9)', function() {
                  publishDidValidateEvents( data.simpleMessages.car3 );

                  var carMessages = data.simpleMessages.car[ 0 ].data.concat( data.simpleMessages.car3[ 0 ].data );

                  expect( testBed.scope.model.messages.car )
                     .toEqual( carMessages );

                  expect( testBed.scope.model.messagesForView.length ).toBe( 6 );
               } );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            describe( 'and an exclude list is given', function() {

               beforeEach( function() {
                  setupWithFeatures( { resource: { list: [], exclude: [ 'car', 'pet' ] } } );

                  publishDidValidateEvents( data.simpleMessages.car );
                  publishDidValidateEvents( data.simpleMessages.pet );
                  publishDidValidateEvents( data.simpleMessages.beverage );
               } );

               ///////////////////////////////////////////////////////////////////////////////////////////////

               it( 'messages of excluded resources are not inserted into the respective lists (R5.7)', function() {
                  expect( testBed.scope.model.messages.car ).toBeUndefined();
                  expect( testBed.scope.model.messages.pet ).toBeUndefined();
                  expect( testBed.scope.model.messages.beverage )
                     .toEqual( data.simpleMessages.beverage[ 0 ].data );
               } );

               ///////////////////////////////////////////////////////////////////////////////////////////////

               it( 'messages of resources that are subtopics of excluded resources are not inserted into the respective lists (R5.8)', function() {
                  expect( testBed.scope.model.messages.car ).toBeUndefined();
                  expect( testBed.scope.model.messages.pet ).toBeUndefined();
                  expect( testBed.scope.model.messages.beverage )
                     .toEqual( data.simpleMessages.beverage[ 0 ].data );
               } );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            describe( 'and SUCCESS message should replace others (R5.9)', function() {
               beforeEach( function() {
                  setupWithFeatures( { resource: { list: [], replace: true } } );
               } );

               //////////////////////////////////////////////////////////////////////////////////////////////////

               describe( 'when messages are received', function() {

                  beforeEach( function() {
                     publishDidValidateEvents( data.simpleMessages.car );
                     publishDidValidateEvents( data.simpleMessages.pet );
                     publishDidValidateEvents( data.simpleMessages.beverage );
                  } );

                  //////////////////////////////////////////////////////////////////////////////////////////////////

                  it( 'messages are deleted again for SUCCESS message of a certain resource (R5.9)', function() {

                     publishDidValidateEvents( data.simpleMessages.car3 );

                     expect( testBed.scope.model.messages.car )
                        .toEqual( data.simpleMessages.car3[ 0 ].data );

                     expect( testBed.scope.model.messagesForView.length ).toBe( 4 );

                  } );
               } );
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'if resource list is given', function() {

            beforeEach( function() {
               setupWithFeatures( { resource: { list: [ 'car', 'pet' ] } } );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'only the relevant resources are validated (R5.2)', function() {
               expect( scopeEventBus.subscribe ).not.toHaveBeenCalledWith( 'didValidate', ANY_FUNCTION );
               expect( scopeEventBus.subscribe ).not.toHaveBeenCalledWith( 'didReplace', ANY_FUNCTION );

               expect( scopeEventBus.subscribe ).toHaveBeenCalledWith( 'didValidate.car', ANY_FUNCTION );
               expect( scopeEventBus.subscribe ).toHaveBeenCalledWith( 'didValidate.pet', ANY_FUNCTION );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            describe( 'when messages are received', function() {

               beforeEach( function() {
                  publishDidValidateEvents( data.simpleMessages.car );
                  publishDidValidateEvents( data.simpleMessages.pet );
                  publishDidValidateEvents( data.simpleMessages.beverage );
               } );

               ///////////////////////////////////////////////////////////////////////////////////////////////

               it( 'relevant messages are inserted into the respective lists (R5.3, R5.6)', function() {
                  expect( testBed.scope.model.messages.car )
                     .toEqual( data.simpleMessages.car[ 0 ].data );
                  expect( testBed.scope.model.messages.pet )
                     .toEqual( [ data.simpleMessages.pet[ 0 ].data[ 0 ], data.simpleMessages.pet[ 1 ].data[ 0 ] ] );
                  expect( testBed.scope.model.messages.beverage ).toBeUndefined();
               } );

               ///////////////////////////////////////////////////////////////////////////////////////////////

               it( 'messages are deleted again for didReplace of a certain resource (R5.4)', function() {
                  publishDidReplaceEvents( [ { resource: 'pet', data: {} } ] );

                  expect( testBed.scope.model.messages.car )
                     .toEqual( data.simpleMessages.car[ 0 ].data );
                  expect( testBed.scope.model.messages.pet ) .toEqual( [] );
                  expect( testBed.scope.model.messages.beverage ).toBeUndefined();

                  expect( testBed.scope.model.messagesForView.length ).toBe( 2 );
               } );

               ///////////////////////////////////////////////////////////////////////////////////////////////

               it( 'messages are deleted again for validateRequest of a certain resource (R5.4)', function() {
                  eventBus.publish( 'validateRequest.pet', { resource: 'pet' } );
                  jasmine.Clock.tick( 0 );

                  expect( testBed.scope.model.messages.car )
                     .toEqual( data.simpleMessages.car[ 0 ].data );
                  expect( testBed.scope.model.messages.pet ) .toEqual( [] );

                  expect( testBed.scope.model.messagesForView.length ).toBe( 2 );
               } );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            describe( 'and an exclude list is given', function() {

               beforeEach( function() {
                  setupWithFeatures( { resource: { list: [ 'car', 'pet' ], exclude: [ 'pet' ] } } );

                  publishDidValidateEvents( data.simpleMessages.car );
                  publishDidValidateEvents( data.simpleMessages.pet );
                  publishDidValidateEvents( data.simpleMessages.beverage );
                  publishDidValidateEvents( data.subMessages[ 'pet-health' ] );
               } );

               ///////////////////////////////////////////////////////////////////////////////////////////////

               it( 'messages of excluded resources are not inserted into the respective lists (R5.7)', function() {
                  expect( testBed.scope.model.messages.car )
                     .toEqual( data.simpleMessages.car[ 0 ].data );
                  expect( testBed.scope.model.messages.pet ).toBeUndefined();
                  expect( testBed.scope.model.messages.beverage ).toBeUndefined();
               } );

               ///////////////////////////////////////////////////////////////////////////////////////////////

               it( 'sub-resources of excluded resources are not inserted into the respective lists (R5.8)', function() {
                  expect( testBed.scope.model.messages[ 'pet-health' ] ).toBeUndefined();
               } );
            } );
         } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with feature errors', function() {

         describe( 'when the feature is enabled', function() {

            beforeEach( function() {
               setupWithFeatures( { errors: { enabled: true } } );

               eventBus.publish( 'didEncounterError.HTTP_PUT', {
                  code: 'HTTP_PUT',
                  message: 'There was an error'
               } );
               jasmine.Clock.tick( 0 );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'the widget subscribes to this type of events (R6.2)', function() {
               expect( scopeEventBus.subscribe ).toHaveBeenCalledWith( 'didEncounterError', ANY_FUNCTION );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'the treats the events as validation messages of outcome ERROR of a special resource (R6.1, R6.3)', function() {
               expect( testBed.scope.model.messages._DID_ENCOUNTER_ERROR_RESOURCE ).toEqual( [ {
                  level: 'ERROR',
                  htmlMessage: 'There was an error',
                  sortKey: '000'
               } ] );
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'when the feature is disabled', function() {

            beforeEach( function() {
               setupWithFeatures( { errors: { enabled: false } } );
               eventBus.publish( 'didEncounterError');
               jasmine.Clock.tick( 0 );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'the widget ignores this type of events (R6.2)', function() {
               expect( scopeEventBus.subscribe ).not.toHaveBeenCalledWith( 'didEncounterError', ANY_FUNCTION );
            } );
         } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with feature i18n', function() {

         var $element_;

         beforeEach( function() {
            setupWithFeatures( {
               resource: { list: [ 'beverage', 'car' ] },
               dismiss: { enabled: true },
               layout: { variant: 4 }
            } );
            $element_ = renderWidget();
            publishDidValidateEvents( data.simpleMessages.car );
         } );

         //////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'updates the message as the locale changes (R7.1)', function() {
            var messages = [];
            $element_.find( '[data-ng-bind-html="message.htmlText"]' ).each( function() {
               messages.push( $( this ).text() );
            } );
            expect( messages ).toContain( data.simpleMessages.car[ 0 ].data[ 0 ].htmlMessage.en_US );
            expect( messages ).toContain( data.simpleMessages.car[ 0 ].data[ 1 ].htmlMessage.en_US );


            eventBus.publish( 'didChangeLocale.default', {
               locale: 'default',
               languageTag: 'de_DE'
            } );
            jasmine.Clock.tick( 0 );

            messages = [];
            $element_.find( '[data-ng-bind-html="message.htmlText"]' ).each( function() {
               messages.push( $( this ).text() );
            } );
            expect( messages ).toContain( data.simpleMessages.car[ 0 ].data[ 0 ].htmlMessage.de_DE );
            expect( messages ).toContain( data.simpleMessages.car[ 0 ].data[ 1 ].htmlMessage.de_DE );
         } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function publishDidReplaceEvents( events ) {
         events.forEach( function( event ) {
            eventBus.publish( 'didReplace.' + event.resource, event );
            jasmine.Clock.tick( 0 );
         } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function publishDidValidateEvents( events ) {
         events.forEach( function( event ) {
            eventBus.publish( 'didValidate.' + event.resource, event );
            jasmine.Clock.tick( 0 );
         } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function renderWidget() {
         var $compile = null;
         angularMocks.inject( function( _$compile_ ) {
            $compile = _$compile_;
         } );

         var element = $compile( template )( testBed.scope );
         $container.append( element );
         testBed.scope.$digest();

         $wrapper = $( $container.children().get( 0 ) );
         return $container;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function setupWithFeatures( features ) {
         testBed.featuresMock = features;
         testBed.setup();

         eventBus = testBed.eventBusMock;
         scopeEventBus = testBed.scope.eventBus;

         eventBus.publish( 'didChangeLocale.default', {
            locale: 'default',
            languageTag: 'en_US'
         } );
         jasmine.Clock.tick( 0 );
      }
   } );
} );
