/**
 * Copyright 2015-2017 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
/* eslint-env node */

const path = require( 'path' );
const pkg = require( './package.json' );

const webpack = require( 'laxar-infrastructure' ).webpack( {
   context: __dirname,
   rules: [
      {
         test: /\.js$/,
         exclude: 'node_modules',
         loader: 'babel-loader'
      },
      {
         test: /\.spec.js$/,
         exclude: 'node_modules',
         loader: 'laxar-mocks/spec-loader'
      }
   ],
   alias: {
      'laxar-angular-adapter': path.resolve( '../../lib/laxar-angular-adapter' ),
      'laxar-mocks': path.resolve( '../../lib/laxar-mocks' )
   }
} );


module.exports = [
   // webpack.library(),
   webpack.browserSpec( [ `./spec/${pkg.name}.spec.js` ] )
];
