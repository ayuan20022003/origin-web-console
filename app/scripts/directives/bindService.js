'use strict';

(function() {
  angular.module('openshiftConsole').component('bindService', {
    controller: [
      '$scope',
      '$filter',
      'APIService',
      'ApplicationsService',
      'BindingService',
      'DataService',
      'ServiceInstancesService',
      BindService
    ],
    controllerAs: 'ctrl',
    bindings: {
      target: '<',
      project: '<',
      onClose: '<'
    },
    templateUrl: 'views/directives/bind-service.html'
  });

  function BindService($scope,
                       $filter,
                       APIService,
                       ApplicationsService,
                       BindingService,
                       DataService,
                       ServiceInstancesService) {
    var ctrl = this;
    var bindFormStep;
    var bindParametersStep;
    var resultsStep;
    var selectionValidityWatcher;
    var parametersValidityWatcher;
    var bindingWatch;
    var statusCondition = $filter('statusCondition');
    var enableTechPreviewFeature = $filter('enableTechPreviewFeature');

    var preselectService = function(){
      var newestReady;
      var newestNotReady;
      _.each(ctrl.serviceInstances, function(instance) {
        var ready = _.get(statusCondition(instance, 'Ready'), 'status') === 'True';
        if (ready && (!newestReady || instance.metadata.creationTimestamp > newestReady.metadata.creationTimestamp)) {
          newestReady = instance;
        }
        if (!ready && (!newestNotReady || instance.metadata.creationTimestamp > newestNotReady.metadata.creationTimestamp)) {
          newestNotReady = instance;
        }
      });
      ctrl.serviceToBind = newestReady || newestNotReady;
    };

    var sortServiceInstances = function() {
      // wait till both service instances and service classes are available so
      // that the sort is stable and items dont jump around
      if (ctrl.serviceClasses && ctrl.serviceInstances) {
        ctrl.serviceInstances = BindingService.filterBindableServiceInstances(ctrl.serviceInstances, ctrl.serviceClasses);
        ctrl.orderedServiceInstances = BindingService.sortServiceInstances(ctrl.serviceInstances, ctrl.serviceClasses);

        if (!ctrl.serviceToBind) {
          preselectService();
        }
      }
    };

    var deploymentConfigs, deployments, replicationControllers, replicaSets, statefulSets;
    var sortApplications = function() {
      // Don't waste time sorting on each data load, just sort when we have them all
      if (deploymentConfigs && deployments && replicationControllers && replicaSets && statefulSets) {
        var apiObjects =  [].concat(deploymentConfigs)
                            .concat(deployments)
                            .concat(replicationControllers)
                            .concat(replicaSets)
                            .concat(statefulSets);
        ctrl.applications = _.sortBy(apiObjects, ['metadata.name', 'kind']);
        ctrl.bindType = ctrl.applications.length ? "application" : "secret-only";
      }
    };

    var showParameters = function() {
      ctrl.nextTitle = 'Bind';
      if (ctrl.podPresets) {
        validityWatcher = $scope.$watch("ctrl.selectionForm.$valid", function(isValid) {
          ctrl.steps[0].valid = isValid;
        });
      }
    };

    var showResults = function() {
      if (selectionValidityWatcher) {
        selectionValidityWatcher();
        selectionValidityWatcher = undefined;
      }
      if (parametersValidityWatcher) {
        parametersValidityWatcher();
        parametersValidityWatcher = undefined;
      }
      ctrl.nextTitle = "Close";
      ctrl.wizardComplete = true;

      ctrl.bindService();
    };

    var loadApplications = function() {
      var context = {
        namespace: _.get(ctrl.target, 'metadata.namespace')
      };
      // Load all the "application" types
      DataService.list('deploymentconfigs', context).then(function(deploymentConfigData) {
        deploymentConfigs = _.toArray(deploymentConfigData.by('metadata.name'));
        sortApplications();
      });
      DataService.list('replicationcontrollers', context).then(function(replicationControllerData) {
        replicationControllers = _.reject(replicationControllerData.by('metadata.name'), $filter('hasDeploymentConfig'));
        sortApplications();
      });
      DataService.list({
        group: 'apps',
        resource: 'deployments'
      }, context).then(function(deploymentData) {
        deployments = _.toArray(deploymentData.by('metadata.name'));
        sortApplications();
      });
      DataService.list({
        group: 'extensions',
        resource: 'replicasets'
      }, context).then(function(replicaSetData) {
        replicaSets = _.reject(replicaSetData.by('metadata.name'), $filter('hasDeployment'));
        sortApplications();
      });
      DataService.list({
        group: 'apps',
        resource: 'statefulsets'
      }, context).then(function(statefulSetData) {
        statefulSets = _.toArray(statefulSetData.by('metadata.name'));
        sortApplications();
      });
    };

    var loadServiceInstances = function() {
      var context = {
        namespace: _.get(ctrl.target, 'metadata.namespace')
      };

      var serviceInstancesVersion = APIService.getPreferredVersion('serviceinstances');
      DataService.list(serviceInstancesVersion, context).then(function(instances) {
        ctrl.serviceInstances = instances.by('metadata.name');
        sortServiceInstances();
      });
    };

    bindFormStep = {
      id: 'bindForm',
      label: 'Binding',
      view: 'views/directives/bind-service/bind-service-form.html',
      valid: true,
      allowClickNav: true,
      onShow: showBind
    };

    bindParametersStep = {
      id: 'bindParameters',
      label: 'Parameters',
      view: 'views/directives/bind-service/bind-parameters.html',
      hidden: true,
      allowClickNav: true,
      onShow: showParameters
    };

    resultsStep = {
      id: 'results',
      label: 'Results',
      view: 'views/directives/bind-service/results.html',
      valid: true,
      allowClickNav: false,
      onShow: showResults
    };

    var updateInstance = function() {
      if (!ctrl.serviceClasses || !ctrl.servicePlans) {
        return;
      }

      var instance = ctrl.target.kind === 'ServiceInstance' ? ctrl.target : ctrl.serviceToBind;
      if (!instance) {
        return;
      }

      var serviceClassName = ServiceInstancesService.getServiceClassNameForInstance(instance);
      ctrl.serviceClass = ctrl.serviceClasses[serviceClassName];
      var servicePlanName = ServiceInstancesService.getServicePlanNameForInstance(instance);
      ctrl.plan = ctrl.servicePlans[servicePlanName];
      ctrl.parameterSchema = _.get(ctrl.plan, 'spec.serviceBindingCreateParameterSchema');
      ctrl.parameterFormDefinition = _.get(ctrl.plan, 'spec.externalMetadata.schemas.service_binding.create.openshift_form_definition');
      bindParametersStep.hidden = !_.has(ctrl.parameterSchema, 'properties');
      ctrl.nextTitle = bindParametersStep.hidden ? 'Bind' : 'Next >';
      ctrl.hideBack = bindParametersStep.hidden;
    };

    $scope.$watch("ctrl.serviceToBind", updateInstance);

    ctrl.$onInit = function() {
      ctrl.serviceSelection = {};
      ctrl.projectDisplayName = $filter('displayName')(ctrl.project);
      ctrl.podPresets = enableTechPreviewFeature('pod_presets');

      ctrl.steps = [ bindFormStep, bindParametersStep, resultsStep ];
      ctrl.hideBack = bindParametersStep.hidden;

      // We will want ServiceClasses either way for display purposes
      var serviceClassesVersion = APIService.getPreferredVersion('clusterserviceclasses');
      DataService.list(serviceClassesVersion, {}).then(function(serviceClasses) {
        ctrl.serviceClasses = serviceClasses.by('metadata.name');
        updateInstance();
        sortServiceInstances();
      });

      // We'll need service plans for binding parameters.
      // TODO: Only load plans for selected instance.
      var servicePlansVersion = APIService.getPreferredVersion('clusterserviceplans');
      DataService.list(servicePlansVersion, {}).then(function(plans) {
        ctrl.servicePlans = plans.by('metadata.name');
        updateInstance();
      });

      if (ctrl.target.kind === 'ServiceInstance') {
        ctrl.bindType = "secret-only";
        ctrl.appToBind = null;
        ctrl.serviceToBind = ctrl.target;
        if (ctrl.podPresets) {
          loadApplications();
        }
      }
      else {
        ctrl.bindType = 'application';
        ctrl.appToBind = ctrl.target;
        loadServiceInstances();
      }
    };

    ctrl.$onChanges = function(onChangesObj) {
      if (onChangesObj.project && !onChangesObj.project.isFirstChange()) {
        ctrl.projectDisplayName = $filter('displayName')(ctrl.project);
      }
    };

    ctrl.$onDestroy = function() {
      if (selectionValidityWatcher) {
        selectionValidityWatcher();
        selectionValidityWatcher = undefined;
      }
      if (parametersValidityWatcher) {
        parametersValidityWatcher();
        parametersValidityWatcher = undefined;
      }
      if (bindingWatch) {
        DataService.unwatch(bindingWatch);
      }
    };

    ctrl.bindService = function() {
      var svcToBind = ctrl.target.kind === 'ServiceInstance' ? ctrl.target : ctrl.serviceToBind;
      var application = ctrl.bindType === 'application' ? ctrl.appToBind : undefined;

      var context = {
        namespace: _.get(svcToBind, 'metadata.namespace')
      };

      var serviceClass = BindingService.getServiceClassForInstance(svcToBind, ctrl.serviceClasses);
      BindingService.bindService(svcToBind, application, serviceClass, ctrl.parameterData).then(function(binding){
        ctrl.binding = binding;
        ctrl.error = null;

        bindingWatch = DataService.watchObject(BindingService.bindingResource, _.get(ctrl.binding, 'metadata.name'), context, function(binding) {
          ctrl.binding = binding;
        });
      }, function(e) {
        ctrl.error = e;
      });
    };

    ctrl.closeWizard = function() {
      if (_.isFunction(ctrl.onClose)) {
        ctrl.onClose();
      }
    };
  }
})();
