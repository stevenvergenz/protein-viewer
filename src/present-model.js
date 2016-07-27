'use strict';

// set up global variables
var sync, renderer, camera, model;
var scene = new THREE.Scene();
var root = new THREE.Object3D();
scene.add(root);


function computeObjectRadius(o, center)
{
	center = center || new THREE.Vector3(0,0,0);

	if(o instanceof THREE.Mesh)
	{
		var max = 0;
		o.geometry.vertices.forEach(function(vert)
		{
			var test = vert.distanceTo(center);
			if(test > max) max = test;
		});

		return max;
	}
	else
	{
		var max = 0;
		o.children.forEach(function(child)
		{
			var inverse = new THREE.Matrix4().getInverse(child.matrix);
			var test = computeObjectRadius(child, center.clone().applyMatrix4(inverse));
			if(test > max) max = test;
		});

		return max;
	}
}

// start loading everything in the right order
async.parallel(
	[
		loadModels,
		setupRenderer,
		setupEnclosure
	],
	start
);

function loadModels(done)
{
	async.map(
		[/*'2M6C.pdb' ,*/ '2VAA.pdb'],

		function(item, done)
		{
			var molecule = new THREE.Object3D();
			var loader = new THREE.PDBLoader();
			loader.load('models/'+item, function(models)
			{
				var model = models[0];

				var radius = computeObjectRadius(model);
				model.scale.multiplyScalar(1.5/radius);

				done(null, model);
			});
		},
		done
	);
}


function setupRenderer(done)
{
	if(altspace.inClient){
		renderer = altspace.getThreeJSRenderer();
	}
	else {
		// set up preview renderer, in case we're out of world
		renderer = new THREE.WebGLRenderer();
		renderer.setSize(720, 720);
		renderer.setClearColor( 0 );
		document.body.appendChild(renderer.domElement);

		//camera = new THREE.PerspectiveCamera(90, 1, 0.01, 10000);
		camera = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 100);
		camera.up.set(0,0,1);
		camera.position.set(1.4, 0, 1.5);
		camera.lookAt(new THREE.Vector3(0, 0, 1.5));
		root.add(camera);

		// add bounding box
		/*var box = new THREE.Mesh(
			new THREE.BoxGeometry(3,3,3),
			new THREE.MeshBasicMaterial({wireframe: true})
		);
		box.position.set(0,0,1.5);
		root.add(box);*/
	}

	done();
}


function setupEnclosure(done)
{
	if(altspace.inClient)
	{
		altspace.getEnclosure().then(function(e){
			root.position.setY(-e.innerHeight/2);
			root.scale.multiplyScalar(e.pixelsPerMeter);
			root.rotation.set( -Math.PI/2, 0, 0 );
			done(e.innerDepth===1);
		});
	}
	else {
		done();
	}
}

function start(err, results)
{
	if(err){
		console.error(err);
		return;
	}
	console.log(results);

	window.molecule = results[0][0];
	molecule.position.set(0,0,1.5);
	root.add(molecule);


	// start animating
	window.requestAnimationFrame(function animate(timestamp)
	{
		window.requestAnimationFrame(animate);
		scene.updateAllBehaviors();
		renderer.render(scene, camera);
	});
}

