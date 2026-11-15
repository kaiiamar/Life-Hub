# Spec: Routine R2 — 4-session rotation, two-house weeks, AWS study tracker

Status: ready for Kiro · Effective date: **2026-11-16** · Supersedes recurring plan `R1` from that date

## 1. Why

R1 (`DAILY_BASICS_RECURRING_PLAN`, effective 2026-11-02) assigns a workout to every weekday. Seven planned days felt overwhelming and Kai dropped off. From 16 Nov:

- **4 gym sessions a week**, max 60 min, run as a rotation (not tied to weekdays), because gym days move with Martin's shifts on alternate weeks.
- **Two houses on alternate weeks** (switch on Sundays): home → The Gym Group Peckham; Martin's → PureGym Dartford.
- **A 20-minute cardio minimum** counts as a session.
- **AWS AI Practitioner study** (exam Thu 17 Dec 2026): 45-min blocks Mon–Thu at 14:00 (backup 16:15), 15-min minimum counts.

All copy must follow the zero-guilt principle: missed sessions are skipped, not repaid; no streak-loss, red warnings or "overdue" language; re-entry costs nothing.

## 2. Plan definition (add to `js/training-plan-v1.js`)

Add a new frozen global `DAILY_BASICS_RECURRING_PLAN_R2`. Keep `DAILY_BASICS_RECURRING_PLAN` (R1) untouched so R1 history still validates.

```js
var ROTATION_PLAN={
  id:'daily-basics-recurring-2026',version:1,contentRevision:'R2',title:'Workout plan · 4-session rotation',
  effectiveDate:'2026-11-16',weekStartsOn:1,scheduling:'rotation',weeklyTarget:4,goodWeek:3,
  rotation:['UPPER-A','LOWER-A','UPPER-B','LOWER-B'],
  safety:RECURRING_PLAN.safety, // reuse R1 safety copy; add the line below
  avoid:['Running','Jumping','Lunges','Bulgarian split squats','Step-ups','Cross trainer'],
  progression:{key:'evergreen',rangeKey:'consistency',label:'Ongoing practice',rir:2,progressionMode:'top-of-range',guidance:'Hit the top of the rep range on every set, then add the smallest step next time. Stop or swap anything that provokes the hip.'},
  warmUp:{label:'Bike warm-up',durationSec:300},
  sessions:{
    'UPPER-A':{label:'Upper A',focus:'Pull focus',kind:'strength',durationMin:55,finisher:{name:'Rower, easy to moderate',durationSec:600}},
    'LOWER-A':{label:'Lower A',focus:'Glutes and quads',kind:'strength',durationMin:55,finisher:{name:'Bike, steady',durationSec:900}},
    'UPPER-B':{label:'Upper B',focus:'Push focus',kind:'strength',durationMin:55,finisher:{name:'Stair climber',durationSec:600}},
    'LOWER-B':{label:'Lower B',focus:'Glutes and hamstrings',kind:'strength',durationMin:55,finisher:{name:'Incline walk',durationSec:900}},
    'MIN-CARDIO':{label:'Minimum session',focus:'20 min bike, rower, stairs or incline walk',kind:'cardio',durationMin:20,minimum:true,options:['Bike','Rower','Stair climber','Incline walk']}
  },
  exercises:{
    'UPPER-A':[
      strength('R2UA1','Dead hang',3,10,20,'bodyweight',{mode:'time',unit:'seconds',skill:'pull-up'}),
      strength('R2UA2','Assisted pull-up machine',3,6,8,'assistance',{skill:'pull-up'}),
      strength('R2UA3','Lat pulldown',3,8,12,'cable'),
      strength('R2UA4','Seated cable row',3,10,12,'cable'),
      strength('R2UA5','Incline push-up (bench)',3,5,8,'bodyweight',{skill:'push-up'})
    ],
    'LOWER-A':[
      strength('R2LA1','Leg press',3,10,12,'machine',{lowerBody:true}),
      strength('R2LA2','Hip thrust machine',3,10,12,'machine',{lowerBody:true}),
      strength('R2LA3','Seated hamstring curl',3,12,15,'machine',{lowerBody:true}),
      strength('R2LA4','Leg extension',2,12,15,'machine',{lowerBody:true}),
      strength('R2LA5','Hip abduction machine',2,15,20,'machine',{lowerBody:true}),
      strength('R2LA6','Dead bug',2,8,8,'bodyweight',{sides:'each'})
    ],
    'UPPER-B':[
      strength('R2UB1','Knee push-ups',3,1,8,'bodyweight',{skill:'push-up',instruction:'As many as possible, stop 1 short of failure'}),
      strength('R2UB2','Machine chest press',3,8,12,'machine'),
      strength('R2UB3','Assisted pull-up, 3-second lowering',3,5,5,'assistance',{skill:'pull-up'}),
      strength('R2UB4','Chest-supported row',3,10,12,'machine'),
      strength('R2UB5','Seated shoulder press',2,10,12,'machine'),
      strength('R2UB6','Plank',3,20,30,'time',{mode:'time',unit:'seconds'})
    ],
    'LOWER-B':[
      strength('R2LB1','Dumbbell Romanian deadlift',3,10,10,'db-pair',{lowerBody:true}),
      strength('R2LB2','Glute bridge (dumbbell)',3,12,12,'db',{lowerBody:true}),
      strength('R2LB3','Leg press',3,12,12,'machine',{lowerBody:true}),
      strength('R2LB4','Seated hamstring curl',2,12,15,'machine',{lowerBody:true}),
      strength('R2LB5','Hip abduction machine',2,15,20,'machine',{lowerBody:true}),
      strength('R2LB6','Pallof press',2,10,10,'cable',{sides:'each'})
    ],
    'MIN-CARDIO':[
      {id:'R2MC1',name:'Cardio (choose machine)',mode:'time',unit:'minutes',loadType:'time',fixedSets:1,prescribedDurationSec:1200,targetLabel:'20 minutes',noProgression:true}
    ]
  },
  skills:{
    'push-up':['3 × 8 knee push-ups','Incline push-ups, lowering the bench over time','3 × 8 on a low incline','First full push-up'],
    'pull-up':['30-second dead hang','Assisted pull-up: drop one notch at 3 × 8','Slow negatives from a box once assistance is light','First full pull-up']
  },
  locations:{
    home:{label:'Home week',gym:'The Gym Group Peckham',defaultSlots:['Mon 12:30','Wed 12:30','Fri 12:30','Sat late morning'],backup:'Same day 17:30'},
    martin:{label:"Martin's week",gym:'PureGym Dartford',defaultSlots:[],note:"Set on Sunday from Martin's shifts; mornings by default"}
  }
};
global.DAILY_BASICS_RECURRING_PLAN_R2=deepFreeze(ROTATION_PLAN);
```

`strength()` is the existing helper in this file; add `mode`/`unit` overrides through its `extra` argument as shown.

## 3. Behaviour

### 3.1 Rotation instead of weekday mapping

- `RECURRING_EFFECTIVE_DATE_R2='2026-11-16'`. For `key >= R2 effective date`, `currentWorkoutOccurrence(key)` returns:
  - **today:** the *next session in rotation* — the code after the most recent completed R2 session (excluding `MIN-CARDIO`, which does not advance the rotation). No R2 history → `UPPER-A`.
  - **a past date with an R2 session:** that session's occurrence.
  - **a past date with no session:** `null` (not "missed").
  - **a future date:** `null` in calendars; Today/Planner show "Next up: {label}" only.
- Occurrence id: `daily-basics-recurring-2026__R2__{date}__{code}`.
- One R2 session per date. Tapping **Minimum session** on Today creates a `MIN-CARDIO` occurrence for today instead of the rotation session.
- Dates `< 2026-11-16` keep the R1 / Winter Arc logic exactly as now.

### 3.2 Week count (replaces daily pass/fail for workouts)

- Week = Mon–Sun (`weekStartsOn:1`). Count completed R2 sessions in the week, `MIN-CARDIO` included.
- Display: `{n} of 4 this week`. At 3 show "Good week"; at 4 show "Great week". Nothing shown for under 3 — no negative states.

### 3.3 Location week

- `STATE.routine.weeks[{weekKey}] = 'home' | 'martin'`. Default: alternate from `2026-11-16 = home`, switching on Sunday (a week keyed from Sunday 22 Nov is `martin`, etc.). Kai can flip any week from the This Week tab.
- Today's training card shows the gym name for the current week.
- Sunday prompt card (Sunday only): "Plan the week" checklist — Martin's shifts → 4 gym slots, 4 study blocks, lunches + shop, pack gym kit. Ticks stored per week; nothing happens if skipped.

### 3.4 AWS study tracker (new module `js/study.js`)

State:
```js
STATE.study={
  goal:{id:'aws-aif-c01',label:'AWS AI Practitioner (AIF-C01)',examDate:'2026-12-17',examBooked:false,defaultSlot:'14:00',backupSlot:'16:15'},
  course:{label:'Ultimate AWS Certified AI Practitioner AIF-C01',sectionsTotal:14,sectionsDone:0},
  sessions:{/* id: {id,date,minutes,kind:'course'|'practice'|'review'} */},
  practiceScores:[/* {date,label,percent} */]
}
```
- Today card: "Study · 45 min block" with buttons **Log 45**, **Log 15 (minimum)**, custom minutes. Any logged session on a weekday counts the day.
- Week count: `{n} of 4 study days`. Same Good/Great copy as gym.
- Progress: sections done / 14 (stepper), practice score list, neutral exam line "Exam: Thu 17 Dec" (no countdown pressure, no red).
- Weekly target by plan week: wk1–4 course quarters, wk5 practice exams (store as `STATE.study.plan` data, copy only).

### 3.5 Food and weight (copy only, no new tracking)

Today keeps water. Add a static "Food rules" panel on the Fuel tab: 1,750 kcal flat daily target (≈600 below estimated 2,350 maintenance; exercise already included, don't add it back), up to ~1,900 on pre-period hungry days; protein 120–140 g/day; one savoury snack; no casual drinks, plan occasion drinks in advance. Weekly weigh-in on Monday stays in the existing weight card.

## 4. Code touchpoints

| File | Change |
| --- | --- |
| `js/training-plan-v1.js` | Add `DAILY_BASICS_RECURRING_PLAN_R2` (section 2). Leave R1 frozen as-is. |
| `js/winter-arc.js` | Add `RECURRING_REVISION_R2`, `recurringRotationOccurrence(key)`, `nextRotationCode()`. Branch `currentWorkoutOccurrence`, `workoutOccurrenceForSession`, `sessionMatchesOccurrence` (line ~128), `updateTrainingBlockDuration` (~228), `phaseCopy` (~283) and the exercise-logging guard at ~372 on revision so both `R1` and `R2` are accepted for their own date ranges. Safety choices (`REC-SAFETY`, `REST-SAFETY`) keep working on R2. |
| `js/persistence.js` | `_validateRecurringSession` (~258): accept `R1` for dates `< 2026-11-16`, `R2` for dates `>= 2026-11-16` with `code ∈ rotation ∪ {MIN-CARDIO}`; R2 identity check uses the stored code. Rest-provenance scan (~312) includes R2. Validate `STATE.routine` and `STATE.study`. |
| `js/workouts.js` | `allTrainingHistory` (~502): treat `R2` as current plan. Calendar (~516): show logged R2 sessions only; no planned markers on future/past empty days. |
| `js/dashboard.js` | Today training card: "Next up" + gym name + **Start** + **Minimum session**; week count chip. Add study card. |
| `js/planner.js` | This Week (~1615): replace weekday split list with 4-slot week count + location toggle + Sunday checklist. |
| `js/study.js` (new) | Section 3.4. Register in `index.html` and `sw.js` cache list. |
| `index.html`, `sw.js` | Bump shell/service-worker version together (see `tests/release-version.test.js`). |

## 5. Acceptance criteria

1. On 2026-11-15 Today shows the R1 workout; on 2026-11-16 Today shows "Next up: Upper A" at The Gym Group Peckham.
2. Completing Upper A on Mon 16 makes Tue 17 show "Next up: Lower A"; skipping Tuesday leaves Wednesday on Lower A (skipped, not repaid).
3. Logging Minimum session counts toward the week (n of 4) but does not advance the rotation.
4. 3 sessions → "Good week", 4 → "Great week", fewer → count only, no negative copy anywhere.
5. Week of Sun 22 Nov defaults to Martin's week / PureGym Dartford; flipping it persists to Firestore.
6. Existing R1 and Winter Arc sessions load and validate unchanged; persistence rejects an R1 session dated ≥ 2026-11-16 and an R2 session dated < 2026-11-16.
7. Study: Log 15 on a weekday counts the day; 4 study days → "Great week"; practice scores list newest first.
8. No running, jumping, lunges, split squats, step-ups or cross trainer appear anywhere in R2.
9. All existing tests pass; new tests cover criteria 1–8 (suggested files: `tests/rotation-plan-r2.test.js`, `tests/study-tracker.test.js`, extend `tests/recurring-session-validation.test.js`).

## 6. Out of scope

Finance changes (budget already planned; no work needed), the £20 gym-unlock idea (parked), Telegram bot prompts for study (follow-up in `lifehub-notifications`).
