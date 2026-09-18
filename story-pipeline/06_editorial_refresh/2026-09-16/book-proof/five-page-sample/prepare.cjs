'use strict';
// Data preparation for the existing owner-draft CLI. No providers or credentials.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { previewSha, previewStory, validatePreviewPlan } = require('../../../../../lib/local-story-preview.ts');
const { validatePreviewContinuity } = require('../../../../../lib/local-preview-quality.ts');
const { loadOwnerDraft, ownerDraftPagePrompt, ownerDraftPropBoardPrompt } = require('../../../../../scripts/run-owner-book-draft.ts');
const repo = path.resolve(__dirname, '../../../../..');
const revision = 'story-pipeline/04_approved_story_sources/accepted/panda_anat_adventure/revisions/407c34c88fd6c5a851ed253c0534f01332a599222a2d6a6ecff967e65b81d160';
const asset = file => ({ file, sha: previewSha(fs.readFileSync(path.join(repo, file))) });
const storyAsset = asset(`${revision}/story.md`), directionAsset = asset(`${revision}/visual-directions.json`);
assert.equal(storyAsset.sha, '5bed647c29ca61b6fe75ccd39b3e73fb6be5ea2d775f4add220026dc20714b0e');
assert.equal(directionAsset.sha, 'b5e7691a1da79058c95d0f7cd40aeec2725b70c9cbcb0b9ff5d09f11c7ade6ce');
const story = previewStory(fs.readFileSync(path.join(repo, storyAsset.file), 'utf8'), 'בר', 'boy');
const directions = JSON.parse(fs.readFileSync(path.join(repo, directionAsset.file), 'utf8')).pages;
assert.equal(directions.length, 12);
const props = {
  station: 'One fixed brown corrugated-cardboard playhouse on the grass. Closed shallow gabled cardboard roof, one tall rectangular open doorway in the front wall and one square open window on the left side wall. Wide enough for two small players, roof about 1.4 standing child heights. Plain blue tape reinforces the roof ridge and four vertical corners. No rockets, wheels, stars, faces or real machinery.',
  wheel: 'One circular tan cardboard steering wheel, three broad spokes, an uneven hand-drawn rust-red ring around its rim, and exactly one small brass-colored split paper fastener at the center. Diameter 0.27 standing child heights. Flat handmade cardboard, not a black rubber car wheel. No lettering.',
  telescope: 'One plain hollow tan cardboard tube with visible open circular ends, length 0.40 standing child heights and diameter 0.065 child heights. No glass, lenses, tripod, eyepiece fittings or decoration. Exactly one tube, never binoculars.',
  rover: 'One plain lightweight rectangular brown corrugated-cardboard box, open top and COMPLETELY OPEN BOTTOM. Rounded worn upper corners, a short blue-tape patch halfway down each short end. Rim waist-high to a standing five-year-old; capacity exactly two children standing one behind the other. No floor, wheels, axle, motor, seats, roof or windshield. When carried the bottom edge is above knees and separate legs extend below it. Steering wheel is a separate listed object attached only in scene states.',
  rug: 'One plain ochre rectangular woven play rug with a narrow muted teal border, no pictures, writing, face or limbs. About four child heights long and one child height wide. Soft edges can curl or roll, no magical movement, never a bridge.'
};
const cast = {
  adam: 'Adam: same five-year-old boy in every appearance, short straight sandy-blond hair, light skin, mustard T-shirt, navy trousers, plain brown closed shoes. Distinct from curly-haired Bar. No identical twin, no change of outfit.',
  station_driver: 'Station driver: same five-year-old girl, straight dark chin-length bob, medium skin, muted coral dungarees over an ivory shirt, dark closed shoes. Distinct from both boys.',
  ticket_child: 'Ticket child: same five-year-old boy, cropped black hair, medium-brown skin, sage-green shirt, beige trousers, dark closed shoes; a small stack of plain unmarked paper tickets.',
  teacher: 'One adult woman supervising from a distance by the fence; dark hair tied back, muted plum top and dark trousers.',
  station_friends: 'Same small ensemble of two additional preschool friends, one with auburn hair and pale-yellow shirt, one with black braids and blue overalls. Distinct from Bar, Adam, station driver and ticket child.'
};
const geography = 'One ordinary enclosed sunny playground, never outer space. Stable geography: toy shed and fixed cardboard station together at the north/back edge; a low rectangular sandpit in the center-left; a pale compacted-earth path curves clockwise along the right of the sandpit toward a low wooden bench at the south/right. One rooted yellow flower grows beyond the bench beside a rounded green bush. Level green grass, low timber perimeter fence and leafy trees. Station roof/door/window never change. Show only landmarks fitting the camera, never move them to create a new layout. Consistent soft late-morning sunlight, roomy environment.';
// Each row specifies ONE frozen instant, not the sequence of actions in the prose.
const rows = [
  ['wide','high',.33,'steps eagerly toward the entrance holding the loose cardboard wheel at his side','eager anticipation','toward the occupied doorway','pauses next to Bar, watching the occupied entrance',
    'Wide establishing view across the whole playground. Bar and Anat in middle distance approaching the station, station-driver visible sitting inside, ticket-child at doorway. Keep figures separate and roof intact.',
    { station:'Fixed on the grass. Driver seated inside; ticket child at doorway. Its roof stays closed.', wheel:'Single loose wheel carried in Bar\'s right hand, not mounted anywhere.' }],
  ['medium','eye_level',.42,'turns the loose wheel with both hands below his chest, shoulders slightly lowered','quiet disappointment without tears','down toward the wheel','stands beside Bar and looks past the station toward the sandbox path',
    'Three-quarter environmental medium view of the same doorway. Bar at one side, absorbed players beyond him. Preserve visible ground, roof and path, not a face portrait. Players are pretending engine noises, not laughing at Bar.',
    { station:'Same fixed building; driver inside, ticket child at entrance. No lift-off.', wheel:'Single loose wheel held in front of Bar, not a second wheel fixed to the building.' }],
  ['medium','eye_level',.39,'holds the plain tube with both hands and peers through it toward the distant flower','surprised half-smile of discovery','through the open tube toward the yellow flower','watches warmly from beside the two boys, paws relaxed',
    'Medium-wide three-quarter side view. Bar uses the tube; Adam leans closer beside him, hands relaxed and empty, pleased to share. Tube and face contact are clear, no extra hands. A single yellow flower remains rooted beyond the sandpit.',
    { wheel:'Loose wheel leaned upright against the low sandpit border beside Bar\'s foot, not duplicated and not held while using telescope.', telescope:'Exactly one tube in Bar\'s two hands at eye level. Adam is not simultaneously holding another tube.' }],
  ['wide','eye_level',.34,'walks at the front inside the lifted open-bottom box, one hand on mounted wheel and the other supporting front rim','proud playful determination','forward along the path','walks OUTSIDE behind the box, both paws supporting the rear wall',
    'Wide three-quarter side view with distinct overlapping bodies. Exactly Bar and Adam inside, one behind the other, both pairs of legs reaching ground through the open bottom. Anat outside at rear, not inside or under box. Adam supports a side rim with one hand and holds the tube upright with the other. Original station and shed behind.',
    { station:'Same fixed station behind them, empty doorway from this view; do not invent extra named children in foreground.', wheel:'The same single wheel fastened at the upper center of the FRONT short wall; Bar steers.', telescope:'Single tube carried upright in Adam\'s left hand, open ends visible; never floating inside a floorless box.', rover:'Lifted by Bar, Adam and Anat. Only two boys inside, separated legs. Box lower edge stays above their knees, all feet on ground.' }],
  ['wide','high',.28,'keeps one hand at mounted wheel and turns his head back toward the station with an inviting glance','hopeful invitation with a small amused smile','back toward the station, NOT simultaneously into a telescope','catches the rear turn slightly late; rounded belly gently touches the rear edge, paws still support it, expression amused surprise',
    'Extreme-wide high three-quarter view. The same walking box is midway around the sandpit on the curving path. Bar at front, Adam behind inside; Anat outside at rear. One turn moment, NOT later telescope dialogue. Distant station behind and flower ahead locate the route. Generous foreground grass and background sky/trees.',
    { station:'Same stationary playhouse distant behind on grass.', wheel:'Single front-mounted wheel controlled by Bar.', telescope:'Single tube held vertically in Adam\'s left hand, not used by Anat during this selected instant.', rover:'Exactly two boys inside lifted open-bottom box, one panda outside supporting rear. Same size and shape as page4.' }],
  ['medium','eye_level',.40,'makes an open-handed invitation to the station driver','hopeful but tentative','toward the station driver','waits nearby on grass, plainly present and listening',
    'Bar and Adam stand outside the doorway. Driver looks out and ticket child points toward ordinary green grass. Box parked empty nearby. No literal lava.',
    { station:'Unchanged doorway and closed roof.', wheel:'Still attached to parked rover.', telescope:'Held down by Adam beside his body.', rover:'Set down empty on grass, all people outside.' }],
  ['wide','eye_level',.34,'stands beside Adam looking down at Anat','amused surprise','at Anat sitting on grass','sits softly on GRASS BESIDE the curled rug, paws resting naturally, mildly bemused',
    'Single aftermath moment. Partly unrolled rug starts at station and points toward existing path. Anat not on rug or airborne. Teacher distant by fence. Parked rover at path end.',
    { station:'Unchanged distant starting point of rug.', wheel:'Attached to parked empty rover.', telescope:'Held down by Adam, no concurrent telescope viewing.', rover:'Parked empty at path end.', rug:'Partly unrolled with one curled edge beside seated Anat; no motion arrows or magic.' }],
  ['medium','high',.40,'kneels and presses the middle of the rug flat with both palms','delighted concentration','down at rug under his hands','stands holding one end of rug while Adam holds opposite end',
    'Flattening moment only; no earlier helping-hand action. Driver carefully tests already-flat near section with one shoe, bodies separated. Telescope laid visibly on grass outside work area.',
    { station:'Unchanged behind driver.', wheel:'Attached to parked rover.', telescope:'Single tube lies horizontally on grass beyond rug edge, safe and visibly supported.', rover:'Parked empty at path end.', rug:'Now spread flat from station to existing path, normal rug.' }],
  ['close','eye_level',.56,'holds tube at eye level with both hands, considering the bench ahead','thoughtful softened expression','through tube toward bench','stands outside rover pointing gently toward tube without covering Bar\'s hands',
    'Environmental medium-close view, enough rim and distant bench to read positions. Adam at mounted wheel in front of box; Bar behind him navigating. Driver walks OUTSIDE behind. Two children maximum inside.',
    { wheel:'Same wheel on front wall in Adam\'s hands.', telescope:'Single tube in Bar\'s hands only.', rover:'Two boys inside, driver and Anat outside. No floor or wheels.' }],
  ['wide','high',.33,'holds lowered tube in left hand and points to side path with right','sudden understanding','along the available detour beside bush','steadies box rear outside it, stopped before bench',
    'Stopped decision moment, not already turning. Adam pauses at wheel. Driver follows outside behind. Clear path around right side of bench to rooted flower.',
    { wheel:'Same attached wheel held by Adam.', telescope:'Single tube lowered away from Bar\'s face, held in left hand.', rover:'Stopped before bench, intact, two boys inside, no impact.' }],
  ['medium','low',.42,'bends at hips toward flower with hands away from it','absorbed delighted curiosity','at ladybug on rooted yellow flower','stands behind watching friends, relaxed and amused',
    'Low environmental view without making child giant. Parked rover beside path. Adam stands outside holding tube, leaving wheel free. Driver calls to two distant friends approaching from station.',
    { wheel:'Still attached to parked box; no one gripping it at this instant.', telescope:'Single tube held by Adam at his side.', rover:'Set down empty beside path; child has stepped out to inspect flower.' }],
  ['wide','eye_level',.34,'stands with relaxed hands smiling toward Anat after cleanup','warm belonging and amusement','toward Anat speaking','stands with friends and speaks, pleased to be listened to',
    'Final paused conversation, not walking or pushing. All children outside rover. Rug already rolled; no garage or sign exists. Driver and ticket child with two station friends present.',
    { station:'Unchanged playhouse beside shed.', wheel:'Detached and placed in Bar\'s small open tote on the grass, rust-red rim visible; no wheel remains mounted.', telescope:'Single tube returned to Adam and held by him.', rover:'Set down empty near station, wheel detached.', rug:'Already neatly rolled on grass beside fence.' }]
];
const mkPage = (row, pageNumber) => {
  const [shot, angle, fraction, childAction, childExpression, childGaze, companionAction, composition, states] = row;
  const direction = directions[pageNumber - 1];
  return { pageNumber, locationId:'playground', shot, angle, composition, childAction, childExpression, childGaze, companionAction,
    scene: `${direction.setting} SELECTED APPROVED MOMENT: ${direction.mainAction} ${direction.continuityAnchors.join(' ')} Supporting cast: ${direction.supportingCharacters.join(', ')}.`,
    props: Object.entries(states).map(([id,state]) => ({id,state})) };
};
const pages = rows.map((r,i) => mkPage(r,i+1));
pages.unshift({ ...pages[0], pageNumber:0, scene:'Anticipatory cover, Bar and Anat arriving at the playground with loose wheel. Not selected for rendering.',
  composition:'Wide playground, only Bar and Anat together, station distant. No telescope reveal on cover.' });
const plan = { wardrobe:'Bar: teal-blue crewneck knit sweater, rust-orange trousers, mustard-yellow closed shoes with rounded toe caps and one strap; no bare feet. Same curly brown hair and warm face as child anchor. No red shirt, shorts or costume changes.',
  visualLanguage:'Warm refined watercolor picture-book on subtle paper texture, soft natural daylight, spring greens and ochre cardboard with muted blue tape. One coherent scene, generous environment, no typography or panels. Real ordinary playground, imaginative pretend play without literal space scenery.',
  recurringProps:Object.entries(props).map(([id,design])=>({id,design})), locations:[{id:'playground',design:geography}], pages,
  continuity:{ companionStandingHeightInChildHeights:.75,
    entities:[...Object.entries(props).map(([id,design])=>({id,kind:'prop',invariants:[{attribute:'canonical_design',value:design}]})),
      ...Object.entries(cast).map(([id,design])=>({id,kind:'supporting_character',invariants:[{attribute:'identity_and_wardrobe',value:design}]})),
      {id:'playground_map',kind:'landmark',invariants:[{attribute:'geography',value:geography}]}],
    pages:pages.map((p,i)=>({pageNumber:i,visibleLocationIds:['playground'],
      visibleEntityIds:[...p.props.map(o=>o.id),...(i?directions[i-1].supportingCharacters:[]),'playground_map'],changes:[],
      childHeightFraction:i?rows[i-1][2]:.33,environmentAreaFraction:i===9?.42:.65})) } };
validatePreviewPlan(plan,story.pages.length);
validatePreviewContinuity(plan.continuity,plan,[story.title,...story.pages.map(p=>p.text)]);
// Exact accepted direction stays in each render scene. New concrete design choices
// are diagnostic data; they do not mutate the accepted source or held candidate.
for(const d of directions) {
  assert(plan.pages[d.pageNumber].scene.includes(d.mainAction));
  assert.equal(d.companionPresence,'present');
  for(const id of d.supportingCharacters) assert(plan.continuity.pages[d.pageNumber].visibleEntityIds.includes(id));
}
assert(plan.pages[5].props.find(p=>p.id==='telescope').state.includes('not used by Anat'));
assert(plan.pages[6].companionAction.includes('plainly present'));
assert(plan.pages[7].companionAction.includes('GRASS BESIDE'));
assert(plan.pages[8].childAction.includes('presses'));
assert(plan.pages[10].childAction.includes('points'));
assert(plan.pages[12].composition.includes('not walking or pushing'));
assert(!/Bar|Adam|Anat|human child/.test(ownerDraftPropBoardPrompt(plan)));
const inputRoot='outputs/panda-five-page-input-20260919';
const planBytes=JSON.stringify(plan,null,2)+'\n';
const priorIdentity=JSON.parse(fs.readFileSync(path.join(repo,'outputs/panda-book-render-v2-20260915/identity.json'),'utf8'));
const config={intent:'owner_requested_unaccepted_draft',story:storyAsset,plan:{file:`${inputRoot}/plan.json`,sha:previewSha(planBytes)},
  childAnchor:asset(priorIdentity.config.childAnchor.file),companionAnchor:asset(priorIdentity.config.companionAnchor.file),
  childName:'בר',childAge:5,gender:'boy',companionDescription:priorIdentity.config.companionDescription,
  outputDir:'outputs/panda-five-page-sample-20260919',imageBudgetUsd:3.5,qaBudgetUsd:6,samplePages:[1,2,3,4,5],sampleRepairOnce:true};
const evidence={version:'accepted-source-to-owner-draft/v1',story:storyAsset,directions:directionAsset,
  planSha:config.plan.sha,selectedPages:config.samplePages,sourceTextUnchanged:true,
  canonicalCandidateConsumed:false,canonicalHoldUnchanged:true,productionReady:false,providerCalls:0,
  limitations:['manually authored diagnostic design data, not a canonical Blueprint','no independent creative or code PASS for this new plan','no package, runtime or publication authority']};
const files={'plan.json':planBytes,'config.json':JSON.stringify(config,null,2)+'\n','source-binding.json':JSON.stringify(evidence,null,2)+'\n'};
const root=path.join(repo,inputRoot);
if(process.argv.includes('--write')) fs.mkdirSync(root,{recursive:true});
for(const [name,bytes] of Object.entries(files)) {
  const target=path.join(root,name);
  if(fs.existsSync(target)) assert.equal(fs.readFileSync(target,'utf8'),bytes);
  else if(process.argv.includes('--write')) fs.writeFileSync(target,bytes,{flag:'wx'});
}
if(fs.existsSync(path.join(root,'config.json'))) loadOwnerDraft(repo,config);
for(const p of config.samplePages) assert(ownerDraftPagePrompt(plan,p,story.pages[p-1].text,5,'boy',config.companionDescription).length<24000);
console.log(JSON.stringify({...evidence,configFile:`${inputRoot}/config.json`,written:process.argv.includes('--write')},null,2));
