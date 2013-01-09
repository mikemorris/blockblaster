(function(e,t){typeof define=="function"&&define.amd&&define(["../core/core","../core/time","./input","../core/types/Player","../core/types/Enemy"],t)})(this,function(e,t,n,r,i){var s={},o={},u=0,a={};a.input=[],a.server=[];var f=function(n){this.actions=[this.clearCanvas,this.updatePlayers,this.updateNPCs];var s=this.socket=io.connect();s.on("players",function(e){var t=Object.keys(e),i=t.length,o;n.players={};for(var u=0;u<i;u++)o=t[u],n.players[o]=new r(e[o]);s.on("players:add",function(e){n.players[e.uuid]=new r(e.player)}),s.on("players:remove",function(e){delete n.players[e]})}),s.on("npcs",function(e){var t=Object.keys(e),r=t.length,o,u;n.npcs={};for(var a=0;a<r;a++)o=t[a],u=e[o],n.npcs[o]=new i(u.x,u.y,u.direction);s.on("npc:add",function(e){n.npcs[e.uuid]=new i(e.state.x,e.state.y,e.state.direction)}),s.on("npc:destroy",function(e){delete n.npcs[e]})}),s.on("uuid",function(i){n.uuid=i,s.on("state:update",function(i){t.server=i.time,t.client=t.server-e.offset;var s=Object.keys(i.players),o=s.length,u,a,f;if(o)for(var l=0;l<o;l++){u=s[l],a=i.players[u],f=n.players[u],a.ack&&(f.ship.ack=a.ack);if(f&&a.ship){a.ship.state&&(a.ship.state.y&&(f.ship.sy=parseInt(a.ship.state.y)),u===n.uuid?f.ship.reconcile(n,a):a.ship.state.x&&(f.ship.sx=parseInt(a.ship.state.x)));if(a.ship.missiles){var c=a.ship.missiles,h=Object.keys(c),p,d,v;for(var m=0;m<h.length;m++)p=h[m],serverMissile=c[p],v=_.find(f.ship.missiles,function(e,t){return t===p}),serverMissile.state.y&&(v.sy=parseInt(serverMissile.state.y)),serverMissile.state.x&&(v.x=parseInt(serverMissile.state.x)),serverMissile.state.isLive&&(v.isLive=serverMissile.state.isLive==="true"),v.queue.server.push(serverMissile)}}else n.players[u]=new r(a)}var g=Object.keys(i.npcs),y=g.length,u,b,w;if(y)for(var l=0;l<y;l++)u=g[l],b=i.npcs[u],w=n.npcs[u],w&&(i.ack&&(w.ack=i.ack),w.isHit=b.isHit?!0:!1,w.sx=typeof b.x!="undefined"?parseInt(b.x):w.x,w.sy=typeof b.y!="undefined"?parseInt(b.y):w.y,w.rotation=parseInt(b.rotation),w.queue.server.push(b),w.queue.server.length>=e.buffersize&&w.queue.server.splice(-e.buffersize))})})},l=function(e){e=e||this,e.animationFrame=window.requestAnimationFrame(function(){l(e)}.bind(e)),t.setDelta(),p(e)},c=function(){window.cancelAnimationFrame(this.animationFrame),this.areRunning=!1},h=function(){this.areRunning||(this.then=Date.now(),this.loop(),this.areRunning=!0)},p=function(e){for(var t=0;t<e.actions.length;t++)e.actions[t](e)},d=function(e){e.ctx.clearRect(0,0,e.canvas.width,e.canvas.height)},v=function(e,t){this.canvas=document.createElement("canvas"),this.ctx=this.canvas.getContext("2d"),this.canvas.width=e,this.canvas.height=t,document.getElementById("canvas-wrapper").appendChild(this.canvas)},m=function(e){var t=Object.keys(e.players),r=t.length,i,s,o=function(t){var n=Object.keys(t),r=n.length,i,s;for(var o=0;o<r;o++)i=n[o],s=t[i],s.isLive&&(s.interpolate(),s.draw(e))};for(var u=0;u<r;u++)i=t[u],s=e.players[i],i===e.uuid?(s.ship.respondToInput(e,n.pressed),s.ship.move(),s.ship.interpolate()):(s.ship.move(),s.ship.interpolate()),o(s.ship.missiles),s.ship.draw(e)},g=function(e){var t=Object.keys(e.npcs),n=t.length,r,i;for(var s=n;s--;)r=t[s],i=e.npcs[r],i.interpolate(),i.draw(e)};return{players:s,npcs:o,seq:u,queue:a,init:f,loop:l,pause:c,play:h,runFrameActions:p,clearCanvas:d,createCanvas:v,updatePlayers:m,updateNPCs:g}});