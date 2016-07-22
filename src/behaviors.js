'use strict';

(function(exports){

	function abort(behavior, killer){
		if(behavior){
			//console.log('Aborting', behavior.target.name, behavior.type.name, killer ? 'for '+killer.type.name : '');
			behavior.target.removeBehavior(behavior);
			if(behavior.callback)
				behavior.callback();
		}
	}

	function Animate(finalParent, finalPos, finalQuat, finalScale, duration, callback)
	{
		this.parent = finalParent || null;

		if(finalPos instanceof THREE.Matrix4)
		{
			// extract position/rotation/scale from matrix
			this.finalPos = new THREE.Vector3();
			this.finalQuat = new THREE.Quaternion();
			this.finalScale = new THREE.Vector3();
			finalPos.decompose(this.finalPos, this.finalQuat, this.finalScale);

			// shift other arguments
			duration = finalQuat;
			callback = finalScale;
		}
		else
		{
			this.finalPos = finalPos;
			this.finalQuat = finalQuat;
			this.finalScale = finalScale;
		}
		this.parent = finalParent || null;
		this.duration = duration || 1000;
		this.callback = callback;
	}

	Animate.prototype.constructor = Animate;
	Animate.prototype.type = Animate;

	Animate.prototype.awake = function(obj)
	{
		this.target = obj;

		// remove any other animations in progress
		for(var i=0; obj.__behaviorList && i<obj.__behaviorList.length; i++){
			var behavior = obj.__behaviorList[i];
			if(behavior !== this && behavior.startTime)
				abort(behavior, this);
		}

		Utils.reparent(obj, this.parent);

		// read initial positions
		this.initialPos = obj.position.clone();
		this.initialQuat = obj.quaternion.clone();
		this.initialScale = obj.scale.clone();
		this.startTime = Date.now();
	};

	Animate.prototype.update = function(deltaT)
	{
		// compute ease-out based on duration
		var mix = (Date.now()-this.startTime) / this.duration;
		mix = mix < 1 ? -mix * (mix-2) : 1;

		// animate position if requested
		if( this.finalPos ){
			this.target.position.lerpVectors(this.initialPos, this.finalPos, mix);
		}

		// animate rotation if requested
		if( this.finalQuat ){
			THREE.Quaternion.slerp(this.initialQuat, this.finalQuat, this.target.quaternion, mix)
		}

		// animate scale if requested
		if( this.finalScale ){
			this.target.scale.lerpVectors(this.initialScale, this.finalScale, mix);
		}

		this.target.updateMatrix();
		
		var destReached =
			(!this.finalPos || this.target.position.equals(this.finalPos))
			&& (!this.finalQuat || this.target.quaternion.equals(this.finalQuat))
			&& (!this.finalScale || this.target.scale.equals(this.finalScale))
		;

		// terminate animation when done
		if(mix >= 1 || destReached){
			abort(this);
		}
	};


	/*
	 * Animate target away and down
	 */
	
	function DropOff(initV, duration, callback)
	{
		this.initV = initV || new THREE.Vector3();
		this.duration = duration || 2000;
		this.callback = callback || null;
	}

	DropOff.prototype.constructor = DropOff;
	DropOff.prototype.type = DropOff;

	DropOff.accel = new THREE.Vector3(0,0,-10);

	DropOff.prototype.awake = function(obj)
	{
		this.target = obj;
		this.startTime = Date.now();
		this.initP = obj.position.clone();
	}

	DropOff.prototype.update = function()
	{
		var deltaT = (Date.now() - this.startTime);
		if(deltaT >= this.duration)
		{
			this.target.traverse(function(o){ o.visible = false; });
			return abort(this);
		}
		else
			deltaT /= 1000;

		// compute position at this time interval
		var newPos = this.initP.clone();
		newPos.addScaledVector(this.initV, deltaT);
		newPos.addScaledVector(DropOff.accel, 0.5*deltaT*deltaT);
		this.target.position.copy(newPos);
		this.target.updateMatrix();
	}

	exports.abort = abort;
	exports.Animate = Animate;
	exports.DropOff = DropOff;

})(window.B = window.B || {});
