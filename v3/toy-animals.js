// Handmade 3D interpretations of Spiro’s drawings, not recovered original models.
import * as THREE from './vendor/three.module.js';

export function createToyAnimal(name) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const joints = [], materials = new Map();
  function mat(color) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .94 }));
    return materials.get(color);
  }
  function oval(color, x, y, z, sx, sy, sz, parent = body) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat(color));
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function tube(color, points, radius, parent = body) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, radius, 8, false), mat(color));
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function joint(x, y, z, axis, amplitude, phase = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); body.add(g); joints.push({ g, axis, amplitude, phase }); return g;
  }
  function eyes(y, z, spread, size = .085, parent = body) {
    for (const side of [-1, 1]) {
      oval('#fff5d7', side * spread, y, z, size * 1.45, size * 1.6, size, parent);
      oval('#292620', side * spread, y, z + size * .85, size * .6, size * .8, size * .45, parent);
    }
  }
  function legs(color, xs, zs, top, length, radius) {
    xs.forEach((x, i) => zs.forEach((z, j) => {
      const g = joint(x, top, z, 'x', .48, (i + j) % 2 * Math.PI);
      oval(color, 0, -length / 2, 0, radius, length / 2, radius, g);
      oval(color, 0, -length + .09, .07, radius * 1.15, .13, radius * 1.5, g);
    }));
  }
  if (name === 'elephant') {
    const gray = '#a6a69b';
    oval(gray, 0, 1.12, -.18, .64, .65, .91);
    legs(gray, [-.43, .43], [-.7, .4], .92, .8, .21);
    oval(gray, 0, 1.62, .69, .52, .53, .5);
    for (const s of [-1, 1]) {
      const ear = joint(s * .45, 1.7, .5, 'y', .17, s);
      oval('#96998e', s * .2, -.05, 0, .4, .49, .13, ear);
      tube('#fff0c8', [[s * .28,1.35,1],[s * .35,1.23,1.25],[s * .34,1.36,1.4]], .065);
    }
    eyes(1.79, 1.09, .23);
    const trunk = joint(0, 1.5, 1.05, 'z', .18);
    tube(gray, [[0,0,0],[0,-.38,.12],[0,-.8,.19],[0,-.99,.42],[0,-.87,.55]], .15, trunk);
    tube(gray, [[0,1.25,-.9],[0,.95,-1.2],[0,.65,-1.24]], .055);
  } else if (name === 'zebra') {
    const white = '#eee9d8', black = '#454640';
    oval(white, 0, 1.08, -.2, .43, .49, .85);
    legs(white, [-.29,.29], [-.72,.32], .91, .8, .105);
    const neck = oval(white, 0, 1.53, .45, .25, .65, .31); neck.rotation.x = -.3;
    oval(white, 0, 2.02, .65, .29, .29, .48);
    oval(black, 0, 1.95, 1.02, .24, .18, .18);
    for (const s of [-1,1]) oval(white, s * .18, 2.35, .48, .09, .23, .08);
    eyes(2.12, .94, .19, .055);
    // Narrow curved stripes sit on the rounded body rather than a flat billboard.
    for (const z of [-.78,-.48,-.16,.17,.4]) {
      const extent = Math.sqrt(Math.max(.1, 1 - ((z + .2) / .86) ** 2));
      const points = [];
      for (let i=0;i<=16;i++) { const a = i / 16 * Math.PI; points.push([Math.cos(a)*.435*extent,1.08+Math.sin(a)*.5*extent,z]); }
      tube(black, points, .045);
    }
    for (const y of [1.45,1.66,1.86]) for (const s of [-1,1]) tube(black, [[s*.24,y,.36],[s*.26,y+.02,.54],[s*.17,y+.04,.72]], .035);
    tube(black, [[0,2.16,.34],[0,1.85,.08],[0,1.4,-.02]], .08);
    const tail = joint(0,1.2,-.92,'z',.3);
    tube(white, [[0,0,0],[0,-.3,-.22],[0,-.65,-.24]], .04, tail);
    oval(black,0,-.65,-.24,.09,.17,.09,tail);
  } else if (name === 'beaver') {
    const brown = '#ad7e47';
    oval(brown,0,1.02,0,.58,.76,.45);
    oval('#c99b61',0,1,.37,.37,.49,.13);
    oval(brown,0,1.84,.08,.48,.43,.4);
    for (const s of [-1,1]) {
      oval(brown,s*.35,2.15,.03,.17,.19,.12);
      const arm=joint(s*.49,1.39,.1,'x',.5,s*Math.PI/2);
      oval(brown,0,-.29,.07,.14,.36,.15,arm);
    }
    legs(brown,[-.28,.28],[.06],.49,.4,.18);
    const tail=joint(0,.4,-.3,'y',.25);
    oval('#795334',0,-.13,-.58,.35,.12,.65,tail);
    for (const z of [-.35,-.55,-.75,-.95]) tube('#9b7045',[[-.22,-.02,z],[0,0,z+.04],[.22,-.02,z]],.018,tail);
    eyes(1.95,.42,.18);
    oval('#4b3826',0,1.77,.49,.15,.09,.09);
    for (const s of [-1,1]) oval('#fff2ca',s*.065,1.6,.44,.055,.13,.045);
  } else if (name === 'monkey') {
    const brown = '#b8884d';
    oval(brown,0,1.13,0,.36,.57,.3);
    oval('#e4c28a',0,1.15,.25,.25,.38,.1);
    oval(brown,0,1.97,.03,.4,.4,.34);
    oval('#e4c28a',0,1.94,.29,.3,.29,.14);
    for (const s of [-1,1]) {
      oval(brown,s*.42,2,.02,.18,.22,.12); oval('#e4c28a',s*.45,2,.11,.11,.14,.045);
      const arm=joint(s*.32,1.56,0,'x',.65,s*Math.PI/2);
      tube(brown,[[0,0,0],[s*.18,-.35,.05],[s*.22,-.8,.12]],.095,arm);
      oval('#e4c28a',s*.22,-.8,.12,.12,.16,.1,arm);
    }
    legs(brown,[-.22,.22],[0],.73,.62,.11);
    eyes(2.04,.42,.14,.065); oval('#735037',0,1.88,.45,.085,.055,.045);
    const tail=joint(0,.94,-.22,'y',.4);
    tube(brown,[[0,0,0],[.35,.1,-.5],[.65,.6,-.65],[.56,1.08,-.65],[.25,1.12,-.65],[.2,.88,-.65]],.075,tail);
  } else if (name === 'penguin') {
    // Keep the wonderfully unexpected greens, pinks and orange from the drawing.
    oval('#547f5c',0,1.03,0,.49,.79,.36);
    oval('#f2cf4d',0,1.05,.3,.32,.59,.13);
    oval('#edcebb',0,1.89,.03,.31,.34,.29);
    for (const s of [-1,1]) {
      const wing=joint(s*.43,1.5,0,'z',.28,s*Math.PI/2); wing.rotation.z=s*.2;
      oval('#47775a',s*.08,-.37,0,.13,.48,.1,wing);
      const foot=joint(s*.24,.24,0,'x',.45,s*Math.PI/2);
      oval('#df893e',0,-.1,.14,.2,.09,.34,foot);
    }
    eyes(2,.28,.13,.06);
    const beak=new THREE.Mesh(new THREE.ConeGeometry(.13,.42,4),mat('#dc9954'));
    beak.rotation.x=Math.PI/2; beak.position.set(0,1.85,.45); beak.castShadow=true;body.add(beak);
    oval('#edcebb',-.24,2.12,-.02,.25,.1,.11);
  } else if (name === 'snake') {
    const red='#cc7955';
    const points=[];
    for(let i=0;i<=48;i++){const t=i/48*Math.PI*3;const r=.65-i/48*.25;points.push([Math.cos(t)*r,.17+i/48*.13,Math.sin(t)*r-.25]);}
    points.push([-.28,.5,.2],[-.25,.95,.25],[0,1.45,.18],[.05,1.83,.2]);
    tube(red,points,.135);
    const head=joint(.05,1.86,.2,'y',.22);
    oval(red,0,0,.07,.26,.23,.33,head);eyes(.08,.34,.13,.06,head);
    tube('#e0a16d',[[-.08,-.12,.31],[0,-.15,.36],[.1,-.12,.31]],.018,head);
    tube('#aa4540',[[0,-.08,.34],[0,-.1,.55],[-.05,-.1,.61]],.018,head);
    tube('#aa4540',[[0,-.1,.55],[.05,-.1,.61]],.018,head);
  }
  return { root, animate(time, moving, reduced) {
    const t = reduced ? 0 : time;
    body.position.y = moving && !reduced ? Math.abs(Math.sin(t*7))*.045 : 0;
    for(const {g,axis,amplitude,phase} of joints) g.rotation[axis] = moving && !reduced ? Math.sin(t*7+phase)*amplitude : 0;
    if(name==='snake') body.rotation.z = moving && !reduced ? Math.sin(t*5)*.06 : 0;
  } };
}
