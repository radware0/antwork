import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialData, pauseTimer, settleCountdown, generateOccurrences } from './domain.ts';
import { validateImport } from './storage.ts';
import { dailySummary } from './ui.ts';
test('backup rejects malformed nested records', () => {
 const base = createInitialData('2026-09-27');
 for (const patch of [{quests:[null]}, {timer:{}}, {dailyTargets:{'2026-09-27':'bad'}}, {setupDate:'2026-99-99'}]) assert.throws(() => validateImport({...base,...patch}));
 assert.deepEqual(validateImport(base), base);
});

test('version one backup gains an empty profile without losing work', () => {
 const legacy = structuredClone(createInitialData('2026-09-27')) as unknown as Record<string, unknown>;
 delete legacy.profile;
 legacy.schemaVersion = 1;
 const keptSession = {id:'kept',source:'manual',intervals:[{start:1000,end:61000}],note:'First hour',questOccurrenceId:null};
 legacy.sessions = [keptSession];
 const migrated = validateImport(legacy);
 assert.equal(migrated.schemaVersion, 5);
 assert.equal(migrated.setupComplete, true);
 assert.deepEqual(migrated.profile, {name:'',username:'',bio:'',avatar:null,banner:null,links:[]});
 const {campaignId,result,timing,...preservedSession} = migrated.sessions[0];
 assert.equal(timing, 'intervals');
 assert.deepEqual(preservedSession, keptSession);
 assert.equal(campaignId, null);
 assert.equal(result, null);
});
test('version two profile backup round-trips and rejects unsafe media or links', () => {
 const data = createInitialData('2026-09-27');
 data.campaigns.push({id:'c',title:'Launch',note:'',createdAt:1,completedAt:null});
 data.profile = {name:'Ant Runner',username:'',bio:'Lock in.',avatar:'data:image/webp;base64,' + Buffer.from('RIFF0000WEBP').toString('base64'),banner:null,links:[{label:'Portfolio',url:'https://example.com/'}]};
 assert.deepEqual(validateImport(JSON.parse(JSON.stringify(data))), data);
 assert.throws(() => validateImport({...data,profile:{...data.profile,avatar:'data:image/webp;base64,YQ=='}}), /Invalid backup/);
 assert.throws(() => validateImport({...data,profile:{...data.profile,links:[{label:'Bad',url:'javascript:alert(1)'}]}}), /Invalid backup/);
 assert.throws(() => validateImport({...data,sessions:[{id:'bad-link',source:'manual',intervals:[{start:1000,end:2000}],note:'',questOccurrenceId:null,campaignId:'missing'}]}), /broken record links/);
});

test('exhausted paused countdown still settles', () => {
 const timer = pauseTimer({id:'timer',mode:'countdown',durationMs:60000,accumulatedMs:0,intervals:[],runningSince:1000,questOccurrenceId:null},62000);
 assert.deepEqual(settleCountdown(timer,63000)?.intervals,[{start:1000,end:61000}]);
});
test('small surplus stays positive', () => {
 const data = createInitialData('2026-09-27');
 data.weeklyTargets.fill(0);
 const start = new Date(2026,8,27,12).getTime();
 data.sessions.push({id:'s',source:'manual',intervals:[{start,end:start+1000}],note:'',questOccurrenceId:null});
 assert.equal(dailySummary(data,'2026-09-27',start+2000).color,'positive');
});

test('moving a due date does not regenerate the original occurrence', () => {
 const quest = {id:'q',title:'Draft',campaignId:null,stake:10 as const,recurrence:'daily' as const,startDate:'2026-09-27',endDate:null,active:true};
 const items = generateOccurrences([quest],[],'2026-09-27','2026-09-28');
 items[0].dueDate = '2026-09-28';
 assert.equal(generateOccurrences([quest],items,'2026-09-27','2026-09-28').length,2);
});
