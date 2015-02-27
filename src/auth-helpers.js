/**
 *
 * @param {Number} stateAuthLevel
 * @param {Number} userAuthLevel
 * @returns {Boolean}
 * @private
 */
function _authorizeLevelBased( stateAuthLevel, userAuthLevel ) {
   if( !angular.isNumber(userAuthLevel) ) {
      userAuthLevel = 0;
   }

   return ( userAuthLevel >= stateAuthLevel );
}

/**
 *
 * @param {Array} haystack
 * @param {Array} needle
 * @returns {Boolean}
 * @private
 */
function _authorizeRoleBased( haystack, needle ) {
   needle = angular.isArray(needle) ? needle : [needle];

   for(var i = 0, len = haystack.length; i < len; i++) {
      for(var j = 0, jLen = needle.length; j < jLen; j++) {
         if( angular.equals(haystack[i], needle[j]) ) {
            return true;
         }
      }
   }

   return false;
}

/**
 * @param parsedData
 * @param {Object} $exceptionHandler - AngularJS Wrapper for javascript exception!
 * @returns {{user: Object|null, token: string|null}}
 * @private
 */
function _sanitizeParsedData( parsedData, $exceptionHandler ) {
   if( !angular.isObject(parsedData) || !angular.isObject(parsedData.user) || !angular.isString(parsedData.token) || parsedData.token.length < 1 ) {
      $exceptionHandler('AuthServiceProvider.parseHttpAuthData', 'Invalid callback passed. The Callback must return an object like {user: Object, token: String, authLevel: Number|Array}');

      parsedData = {
         user: null,
         token: null,
         authLevel: 0
      };
   }
   return parsedData;
}
