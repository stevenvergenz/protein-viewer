var Object3DSync = altspace.utilities.behaviors.Object3DSync;
var SteamVRInputBehavior = altspace.utilities.behaviors.SteamVRInput;
var SteamVRTrackedObjectBehavior = altspace.utilities.behaviors.SteamVRTrackedObject;

var config = { authorId: 'tom skillman, brain peiris, steven vangenz', appId: 'MoleculeViewer' };
var scene = document.querySelector('a-scene').object3D;
var sceneSync;
var steamVRInput;

var laserVisibilityBehavior = {
  awake: function (obj) {
    var objData = obj.getBehaviorByType('Object3DSync').dataRef;
    objData.child('visible').on('value', function (snapshot) {
      obj.children[0].visible = snapshot.val();
    }.bind(this));
  }
};

function createLaser (data) {
  var laserContainer = new THREE.Group();
  laserContainer.addBehaviors(
    new SteamVRTrackedObjectBehavior(data.hand),
    new Object3DSync({position: true, rotation: true}),
    laserVisibilityBehavior
  );
  scene.add(laserContainer);

  var laserObj = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, 0.01, 5),
    new THREE.MeshBasicMaterial({color: 'red'})
  );
  laserObj.position.z = 2.5 * 50;
  laserObj.scale.multiplyScalar(50);
  laserContainer.add(laserObj);

  return laserContainer;
};

var laserBehavior = {
  update: function () {
    var controller = steamVRInput.firstController;
    if (controller && !this.laser) { 
      this.laser = sceneSync.instantiate('laser', {hand: controller.hand});
      this.laserData = this.laser.getBehaviorByType('Object3DSync').dataRef;
    }
    if (controller && controller.buttons[SteamVRInputBehavior.BUTTON_TRIGGER].pressed) {
      if (!this.visible) {
        this.visible = true;
        this.laserData.child('visible').set(this.visible);
      }
    }
    else if (this.visible) {
      this.visible = false;
      this.laserData.child('visible').set(this.visible);
    }
  }
};

function init (connection) {
  sceneSync = new altspace.utilities.behaviors.SceneSync(connection.instance, {
    instantiators: {
      laser: createLaser
    }
  });
  steamVRInput = new SteamVRInputBehavior();
  scene.addBehaviors(steamVRInput, sceneSync, laserBehavior);
}

altspace.utilities.sync.connect(config).then(init);

function update () {
  requestAnimationFrame(update);
  scene.updateAllBehaviors();
}
update();

