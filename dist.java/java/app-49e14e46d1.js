!function(n){n.pluginName="openshift-jvm",n.log=Logger.get(n.pluginName),n.templatePath="plugins/openshift-jvm/html",n.version={}}(OpenshiftJvm||(OpenshiftJvm={}));!function(n){n._module=angular.module(n.pluginName,[]),n._module.run(["HawtioNav","preferencesRegistry",function(t,e){t.on(HawtioMainNav.Actions.CHANGED,n.pluginName,function(n){n.forEach(function(n){switch(n.id){case"jvm":case"wiki":n.isValid=function(){return!1}}})}),e.addTab("About "+n.version.name,UrlHelpers.join(n.templatePath,"about.html")),n.log.info("started, version: ",n.version.version),n.log.info("commit ID: ",n.version.commitId)}]),n._module.controller("Main.About",["$scope",function(t){t.info=n.version}]),hawtioPluginLoader.registerPreBootstrapTask(function(t){$.ajax({url:"version.json?rev="+Date.now(),success:function(e){try{n.version=angular.fromJson(e)}catch(t){n.version={name:"openshift-jvm",version:""}}t()},error:function(e,o,i){n.log.debug("Failed to fetch version: jqXHR: ",e," text: ",o," status: ",i),t()},dataType:"html"})}),hawtioPluginLoader.addModule(n.pluginName)}(OpenshiftJvm||(OpenshiftJvm={}));var OpenshiftJvm;!function(n){n._module.controller("OpenshiftJvm.MainController",["$scope","ConnectOptions",function(t,e){t.containerName=e.name||"Untitled Container",e.returnTo&&(t.goBack=function(){n.log.debug("Connect options: ",e),window.location.href=e.returnTo})}])}(OpenshiftJvm||(OpenshiftJvm={})),angular.module("openshift-jvm-templates",[]).run(["$templateCache",function(n){n.put("plugins/openshift-jvm/html/about.html",'<div ng-controller="Main.About">\n  <p>Version: {{info.version}}</p>\n  <p>Commit ID: {{info.commitId}}</p>\n  <table class="table table-striped">\n    <thead>\n      <tr>\n        <th>\n          Name\n        </th>\n        <th>\n          Version\n        </th>\n      </tr>\n    </thead>\n    <tbody>\n      <tr ng-repeat="(key, info) in info.packages">\n        <td>{{key}}</td>\n        <td>{{info.version || \'--\'}}</td>\n      </tr>\n    </tbody>\n  </table>\n</div>\n')}]),hawtioPluginLoader.addModule("openshift-jvm-templates");