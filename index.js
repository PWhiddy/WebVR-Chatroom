'use strict';

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;

app.use(express.static(__dirname + '/public'));

const speedFactor = 0.0001;
const pMass = 0.000005;
const simSpeed = 50;
const boxRadius = 500;
var t = Date.now();
var lastPhysicsTick = 0.0;
var lastRenderUpdate = 0.0;
// Physics and rendering periods
var minPhysicsDelay = (1/60)*1000;
var minRenderDelay = (1/15)*1000;
var parts = [];

var players = [];

for (let i=0; i<0; i++) {
	parts.push(new Particle(
		Math.random()*400-200, Math.random()*300-150,
		0, 0, 0, 0, pMass));
}

function Particle(xp, yp, zp, xv, yv, zv, mass) {
	this.x = xp;
	this.y = yp;
	this.z = zp;
	this.xv = xv;
	this.yv = yv;
	this.zv = zv;
	this.m = mass;
}

function Player(xp,yp,zp) {
	this.myID = 0.0;
	this.lastUpdate = 0.0;
    this.x = xp;
	this.y = yp;
	this.z = zp;
	this.xdir = 0;
	this.ydir = 0;
	this.zdir = 0;
	this.r = 0;
	this.g = 0;
	this.b = 0;
	this.text = '';
}

module.exports = Player;

Particle.prototype.move = function(timestep) {
	this.x += this.xv*timestep;
	this.y += this.yv*timestep;
	if (this.x < -boxRadius) {
		this.x = -boxRadius;
		this.xv = Math.abs(this.xv);
	}
	if (this.x > boxRadius) {
		this.x = boxRadius;
		this.xv = -Math.abs(this.xv);
	}
	if (this.y < -boxRadius) {
		this.y = -boxRadius;
		this.yv = Math.abs(this.yv);
	}
	if (this.y > boxRadius) {
		this.y = boxRadius;
		this.yv = -Math.abs(this.yv);
	}
}

module.exports = Particle;

function physicsTick() {
	for (let i = 0; i < parts.length-1; i++) {
		for (let j = i+1; j < parts.length; j++) {
			let a = parts[i];
			let b = parts[j];
		    let dx = a.x-b.x;
			let dy = a.y-b.y;
			let dz = a.z-b.z;
			let distsq = dx*dx+dy*dy+dz*dz+12;
			let f = minPhysicsDelay/distsq;
			a.xv -= f*dx*b.m;
			a.yv -= f*dy*b.m;
			a.zv -= f*dz*b.m;
			b.xv += f*dx*a.m;
			b.yv += f*dy*a.m;
			b.zv += f*dz*a.m;
		}
	}
	for (let p of parts) p.move(simSpeed);
}

function runSim() {
	t = Date.now();
	if (t-lastPhysicsTick > minPhysicsDelay) {
		// run physics step
		physicsTick();
		lastPhysicsTick = t;
	}
	if (t-lastRenderUpdate > minRenderDelay) {
		// push updated particles
		io.sockets.emit('updateScene', parts);
		lastRenderUpdate = t;
	}
}

function createParticle(data) {
  //let xv = speedFactor*(data.fx-data.ix);
  //let yv = speedFactor*(data.fy-data.iy);
  parts.push(new Particle(data.x, data.y, data.z, 0.0001*data.dirX,
                          0.0001*data.dirY, 0.0001*data.dirZ, pMass));
}

function transmitPlayers() {
	io.sockets.emit('tramsitPlayers', players);
}

function updatePlayer(data) {
	let playerFound = false;
	for (let p of players) {
		if (data.id === p.myID) {
			p.lastUpdate = Date.now();
			p.x = data.x;
			p.y = data.y;
			p.z = data.z;
			p.xdir = data.dirx;
			p.ydir = data.diry;
			p.zdir = data.dirz;
			playerFound = true;
		}
	}
	if (!playerFound) {
		let p = new Player(data.x,data.y,data.z);
		p.myID = data.id;
		p.lastUpdate = Date.now();
		p.xdir = data.dirx;
		p.ydir = data.diry;
		p.zdir = data.dirz;
		players.push(p);
	}
	//transmitPlayers();
}

function disconnect() {
	for (let i=0; i <players.length; i++) {
		if (Date.now()-players[i].lastUpdate > 7000) {
			players.splice(i, 1);
		}
	}
}

function onConnection(socket) {

  socket.emit('updateScene', parts);
  // modify this to add particle
  socket.on('addParticle', data => createParticle(data) );
  //socket.on('drawing', (data) => socket.broadcast.emit('drawing', data));

  socket.on('updatePlayer', data => updatePlayer(data));

  setInterval(transmitPlayers, 15);
  setInterval(disconnect, 1000);
  //setInterval(runSim, 15);

}

io.on('connection', onConnection);

http.listen(port, () => console.log('listening on port ' + port));