/**!
 * @Project: angular-hitmands-auth
 * @Authors: Giuseppe Mandato <gius.mand.developer@gmail.com>
 * @Link: https://github.com/hitmands/angular-hitmands-auth
 * @License: MIT
 * @Date: 2015-02-28
 * @Version: 1.1.0
***/

(function(window, angular) {
   'use strict';

   /* @ngInject */
   function AuthModuleRun($rootScope, AuthService, $state, $location, $timeout) {
      function redirect() {
         $timeout(function() {
            $location.path("/");
         }, 0);
      }
      $rootScope.$on("$stateChangeStart", function(event, toState, toParams, fromState, fromParams) {
         if (!AuthService.authorize(toState, AuthService.getCurrentUser())) {
            var _isUserLoggedIn = AuthService.isUserLoggedIn();
            event.preventDefault();
            $rootScope.$broadcast("$stateChangeError", toState, toParams, fromState, fromParams, {
               "statusCode": _isUserLoggedIn ? 403 : 401,
               "statusText": _isUserLoggedIn ? "Forbidden" : "Unauthorized",
               "isUserLoggedIn": _isUserLoggedIn,
               "publisher": "AuthService.authorize"
            });
            fromState.name || redirect();
         }
      });
      $rootScope.$on(EVENTS.update, function(event) {
         AuthService.authorize($state.current, AuthService.getCurrentUser()) || redirect();
      });
   }
   AuthModuleRun.$inject = ['$rootScope', 'AuthService', '$state', '$location', '$timeout'];

   function _validAuthData(userData, token) {
      var res = !0;
      (angular.isArray(userData) || !angular.isObject(userData)) && (res = !1);
      (!angular.isString(token) || token.length < 1) && (res = !1);
      return res;
   }

   function _authorizeLevelBased(stateAuthLevel, userAuthLevel) {
      angular.isNumber(userAuthLevel) || (userAuthLevel = 0);
      return userAuthLevel >= stateAuthLevel;
   }

   function _authorizeRoleBased(haystack, needle) {
      needle = angular.isArray(needle) ? needle : [ needle ];
      for (var i = 0, len = haystack.length; len > i; i++) {
         for (var j = 0, jLen = needle.length; jLen > j; j++) {
            if (angular.equals(haystack[i], needle[j])) {
               return !0;
            }
         }
      }
      return !1;
   }

   function _sanitizeParsedData(parsedData, $exceptionHandler) {
      var valid = !1;
      try {
         valid = _validAuthData(parsedData.user, parsedData.token);
      } catch (error) {}
      if (!valid) {
         $exceptionHandler("AuthServiceProvider.parseHttpAuthData", "Invalid callback passed. The Callback must return an object like {user: Object, token: String, authLevel: Number|Array}");
         parsedData = {
            "user": null,
            "token": null,
            "authLevel": 0
         };
      }
      return parsedData;
   }

   /* @ngInject */
   function AuthProviderFactory($httpProvider) {
      var _dataParser, self = this, isBasicAuthEnabled = !1;
      /**
    * Extends Used Routes
    *
    * @preserve
    * @param {Object} [newRoutes = {login: String, logout: String, fetch: String}]
    */
      self.useRoutes = function AuthServiceRoutesListSetter(newRoutes) {
         angular.isObject(newRoutes) && (routes = angular.extend(routes, newRoutes));
         return self;
      };
      /**
    * Appends Authentication Token to all $httpRequests
    * If a function is passed as second parameter is passed, it will be invoked for all $httpResponses with the config object
    *
    * @preserve
    * @param {String} [tokenKey = 'x-auth-token'] - The Name of the header Key, default x-auth-token
    * @param {Function} [responseInterceptor] - if function passed, it will be invoked on every $httpResponses with the config object
    */
      self.tokenizeHttp = function AuthServiceTokenizeHttp(tokenKey, responseInterceptor) {
         angular.isFunction(tokenKey) && (responseInterceptor = tokenKey);
         (!angular.isString(tokenKey) || tokenKey.length < 1) && (tokenKey = "x-auth-token");
         $httpProvider.interceptors.push(function AuthServiceInterceptor() {
            return {
               "request": function AuthServiceRequestTransform(config) {
                  currentUser instanceof AuthCurrentUser && angular.isObject(config) && config.hasOwnProperty("headers") && (config.headers[tokenKey] = authToken);
                  return config;
               },
               "responseError": angular.isFunction(responseInterceptor) ? responseInterceptor : void 0
            };
         });
         return self;
      };
      /**
    * Encrypts login requests like headers['Authorization'] = 'Basic' + ' ' + btoa(credentials.username + ':' + credentials.password)
    * @preserve
    */
      self.useBasicAuthentication = function AuthServiceUseHttpHeaderAuthorization() {
         isBasicAuthEnabled = !0;
         return self;
      };
      /**
    * @preserve
    * @param {Object|null} [userData=null]
    * @param {Number|null} authLevel
    * @param {String|null} [authenticationToken=null]
    */
      self.setLoggedUser = function AuthServiceLoggedUserSetter(userData, authenticationToken, authLevel) {
         if (!_validAuthData(userData, authenticationToken)) {
            userData = null;
            authenticationToken = null;
         }
         currentUser = userData ? new AuthCurrentUser(userData, authLevel) : null;
         authToken = authenticationToken;
         return self;
      };
      /**
    * @preserve
    * @param {Requester~requestCallback} callback - The callback that handles the $http response.
    */
      self.parseHttpAuthData = function AuthServiceExpectDataAs(callback) {
         angular.isFunction(callback) && (_dataParser = callback);
         return self;
      };
      self.$get = ['$rootScope', '$http', '$state', '$exceptionHandler', '$timeout', '$q', function($rootScope, $http, $state, $exceptionHandler, $timeout, $q) {
         function _setLoggedUser(newUserData, newAuthToken, newAuthLevel) {
            self.setLoggedUser(newUserData, newAuthToken, newAuthLevel);
            $rootScope.$broadcast(EVENTS.update);
            $timeout(function() {
               $rootScope.$$phase || $rootScope.$digest();
            }, 0);
         }
         angular.isFunction(_dataParser) || $exceptionHandler("AuthServiceProvider.parseHttpAuthData", "You need to set a Callback that handles the $http response");
         return {
            /**
          * Performs Login Request and sets the Auth Data
          *
          * @preserve
          * @param {{username: String, password: String}} credentials
          * @returns {ng.IPromise}
          */
            "login": function(credentials) {
               var configs = {
                  "cache": !1
               };
               if (isBasicAuthEnabled) {
                  configs.headers = {
                     "Authorization": "Basic " + window.btoa((credentials.username || "") + ":" + (credentials.password || ""))
                  };
                  delete credentials.username;
                  delete credentials.password;
               }
               return $http.post(routes.login, credentials, configs).then(function(result) {
                  var data = _sanitizeParsedData(_dataParser(result.data, result.headers(), result.status), $exceptionHandler);
                  _setLoggedUser(data.user, data.token, data.authLevel);
                  $rootScope.$broadcast(EVENTS.login.success, result);
                  return result;
               }, function(error) {
                  _setLoggedUser();
                  $rootScope.$broadcast(EVENTS.login.error, error);
                  return $q.reject(error);
               });
            },
            /**
          * Updates the Auth Data
          *
          * @preserve
          * @returns {ng.IPromise}
          */
            "fetchLoggedUser": function() {
               return $http.get(routes.fetch, {
                  "cache": !1
               }).then(function(result) {
                  var data = _sanitizeParsedData(_dataParser(result.data, result.headers(), result.status), $exceptionHandler);
                  _setLoggedUser(data.user, data.token, data.authLevel);
                  $rootScope.$broadcast(EVENTS.fetch.success, result);
                  return result;
               }, function(error) {
                  _setLoggedUser();
                  $rootScope.$broadcast(EVENTS.fetch.error, error);
                  return $q.reject(error);
               });
            },
            /**
          * Performs Logout request
          *
          * @preserve
          * @returns {ng.IPromise}
          */
            "logout": function() {
               return $http.post(routes.logout, null, {
                  "cache": !1
               }).then(function(result) {
                  _setLoggedUser();
                  $rootScope.$broadcast(EVENTS.logout.success, result);
                  return result;
               }, function(error) {
                  _setLoggedUser();
                  $rootScope.$broadcast(EVENTS.logout.error, error);
                  return $q.reject(error);
               });
            },
            /**
          * @preserve
          * @param {Object} user
          * @param {Number} authLevel
          * @param {String} authenticationToken
          */
            "setCurrentUser": function(user, authLevel, authenticationToken) {
               if (!_validAuthData(user, authenticationToken)) {
                  return !1;
               }
               _setLoggedUser(user, authenticationToken, authLevel);
               return !0;
            },
            /**
          * @preserve
          */
            "unsetCurrentUser": function() {
               _setLoggedUser();
               return !0;
            },
            /**
          * @preserve
          * @returns {Object|Null} - Current User Data
          */
            "getCurrentUser": function() {
               return currentUser;
            },
            /**
          * @preserve
          * Checks if the user is logged in
          * @returns {Boolean}
          */
            "isUserLoggedIn": function() {
               return currentUser instanceof AuthCurrentUser;
            },
            /**
          * @preserve
          * @param {Object} state
          * @param {Object} [user = currentUser]
          * @returns {Boolean}
          */
            "authorize": function(state, user) {
               var userAuthLevel, propertyToCheck = AuthCurrentUser.getAuthProperty();
               user = user || currentUser;
               if (!angular.isObject(state)) {
                  $exceptionHandler("AuthService.authorize", "first param must be Object");
                  return !1;
               }
               try {
                  userAuthLevel = user[propertyToCheck] || 0;
               } catch (e) {
                  userAuthLevel = 0;
               }
               var stateAuthLevel = (angular.isObject(state.data) && state.data.hasOwnProperty(propertyToCheck) ? state.data[propertyToCheck] : state[propertyToCheck]) || 0;
               if (angular.isNumber(stateAuthLevel)) {
                  return _authorizeLevelBased(stateAuthLevel, userAuthLevel);
               }
               if (angular.isArray(stateAuthLevel)) {
                  return _authorizeRoleBased(stateAuthLevel, userAuthLevel);
               }
               $exceptionHandler("AuthService.authorize", "Cannot process authorization");
               return !1;
            },
            /**
          * @preserve
          * @param needle {String|Array}
          * @param haystack {Array}
          *
          * @returns {Boolean}
          */
            "checkRoles": function(needle, haystack) {
               return _authorizeRoleBased(haystack, needle);
            },
            /**
          * @preserve
          * @returns {String|Null} - The Authentication Token
          */
            "getAuthenticationToken": function() {
               return authToken;
            }
         };
      }];
   }
   AuthProviderFactory.$inject = ['$httpProvider'];

   /* @ngInject */
   function AuthLoginDirectiveFactory(AuthService) {
      return {
         "restrict": "A",
         "link": function(iScope, iElement, iAttributes) {
            var credentials = iScope[iAttributes.authLogin], resolve = angular.isFunction(iScope.$eval(iAttributes.authLoginOnResolve)) ? iScope.$eval(iAttributes.authLoginOnResolve) : angular.noop, reject = angular.isFunction(iScope.$eval(iAttributes.authLoginOnReject)) ? iScope.$eval(iAttributes.authLoginOnReject) : angular.noop, _form = null;
            try {
               _form = iScope[iElement.attr("name")];
            } catch (error) {}
            iElement.bind("submit", function(event) {
               if (!angular.isObject(credentials)) {
                  event.preventDefault();
                  return reject({
                     "attrName": "auth-login",
                     "attrValue": credentials
                  });
               }
               if (angular.isObject(_form) && _form.hasOwnProperty("$invalid") && _form.$invalid) {
                  event.preventDefault();
                  return reject({
                     "form.$invalid": _form.$invalid,
                     "$form.$pristine": _form.$pristine
                  });
               }
               return AuthService.login(credentials).then(resolve, reject);
            });
            iScope.$on("$destroy", function() {
               iElement.unbind("submit");
            });
         }
      };
   }
   AuthLoginDirectiveFactory.$inject = ['AuthService'];

   /* @ngInject */
   function AuthLogoutDirectiveFactory(AuthService) {
      return function(scope, element, attrs) {
         element.bind("click", function() {
            AuthService.logout();
         });
         scope.$on("$destroy", function() {
            element.unbind("click");
         });
      };
   }
   AuthLogoutDirectiveFactory.$inject = ['AuthService'];

   /* @ngInject */
   function AuthClassesDirectiveFactory(AuthService) {
      var classes = {
         "loggedIn": "user-is-logged-in",
         "notLoggedIn": "user-not-logged-in",
         "last": ""
      };
      return {
         "restrict": "A",
         "scope": !1,
         "link": function(iScope, iElement, iAttributes) {
            function _toggleClass() {
               var newClasses = "";
               if (AuthService.isUserLoggedIn()) {
                  try {
                     newClasses = " user-has-role-" + AuthService.getCurrentUser()[AuthCurrentUser.getAuthProperty()].join(" user-has-role-");
                  } catch (e) {}
                  iAttributes.$updateClass(classes.loggedIn + newClasses, classes.notLoggedIn);
                  classes.last = newClasses;
               } else {
                  iAttributes.$updateClass(classes.notLoggedIn, classes.loggedIn + classes.last);
               }
            }
            _toggleClass();
            iScope.$on(EVENTS.update, function() {
               _toggleClass();
            });
         }
      };
   }
   AuthClassesDirectiveFactory.$inject = ['AuthService'];

   var currentUser = null, authToken = null, routes = {
      "login": "/users/login",
      "logout": "/users/logout",
      "fetch": "/users/me"
   }, EVENTS = {
      "login": {
         "success": "hitmands.auth:login.resolved",
         "error": "hitmands.auth:login.rejected"
      },
      "logout": {
         "success": "hitmands.auth:logout.resolved",
         "error": "hitmands.auth:logout.rejected"
      },
      "fetch": {
         "success": "hitmands.auth:fetch.resolved",
         "error": "hitmands.auth:fetch.rejected"
      },
      "update": "hitmands.auth:update"
   }, AuthCurrentUser = function() {
      function AuthCurrentUser(userData, authLevel) {
         /* jshint ignore:start */
         for (var k in userData) {
            userData.hasOwnProperty(k) && k !== authProperty && (this[k] = userData[k]);
         }
         /* jshint ignore:end */
         Object.defineProperty(this, authProperty, {
            "enumerable": !0,
            "value": authLevel || userData[authProperty] || 0
         });
      }
      var authProperty = "authLevel";
      AuthCurrentUser.getAuthProperty = function() {
         return authProperty;
      };
      return AuthCurrentUser;
   }.call(this);

   angular.module("hitmands.auth", [ "ui.router" ]).provider("AuthService", AuthProviderFactory).directive("authLogin", AuthLoginDirectiveFactory).directive("authLogout", AuthLogoutDirectiveFactory).directive("authClasses", AuthClassesDirectiveFactory).run(AuthModuleRun);
//# sourceMappingURL=angular-hitmands-auth.js.map

})(window, angular);