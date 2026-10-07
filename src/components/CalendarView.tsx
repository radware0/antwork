import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dateKey, dailyWorkedMinutes, sessionDays, setDayRating } from '../domain.ts';
import { calendarSummary, dailySummary, dayQualityLabels, displayDate, hoursLabel } from '../ui.ts';
import type { Mutate } from '../ui.ts';
import type { AppData, CalendarMode, DateKey, DayQuality } from '../types.ts';
import { JournalView } from './JournalView.tsx';
import { DayCard } from './DayCard.tsx';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type CalendarProps = {
  data: AppData; now: number; month: DateKey; onMonth: (month: DateKey) => void; mutate: Mutate;
} & (
  | { mode: 'overview'; onOpen: () => void }
  | { mode: 'interactive'; selectedDay: DateKey; onSelect: (day: DateKey) => void }
);

export function CalendarView(props: CalendarProps) {
  const { data, now, month, onMonth, mutate } = props;
  const [saving, setSaving] = useState(false);
  const qualityMode = data.calendarMode === 'quality';
  const changeMode = async (calendarMode: CalendarMode) => {
    if (saving || calendarMode === data.calendarMode) return;
    setSaving(true);
    try { await mutate(current => ({ ...current, calendarMode })); }
    catch { /* The shared error banner reports persistence failures. */ }
    finally { setSaving(false); }
  };
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(year, monthNumber, 0).getDate();
  const cells: (DateKey | null)[] = [...Array(offset).fill(null)];
  for (let day = 1; day <= count; day++) cells.push(dateKey(new Date(year, monthNumber - 1, day)));
  while (cells.length % 7) cells.push(null);
  const today = dateKey(now);
  const currentMonth = dateKey(new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1));

  return (
    <section className={'panel calendar-panel ' + (props.mode === 'overview' ? 'calendar-overview' : 'calendar-interactive')}>
      <div className="panel-heading calendar-heading">
        <div><h2>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2></div>
        <div className="calendar-actions">
          <button className="icon-button" aria-label="Previous month" onClick={() => onMonth(dateKey(new Date(year, monthNumber - 2, 1)))}><ChevronLeft size={16} /></button>
          <button className="button subtle" onClick={() => { onMonth(currentMonth); if (props.mode === 'interactive') props.onSelect(today); }}>Today</button>
          <button className="icon-button" aria-label="Next month" onClick={() => onMonth(dateKey(new Date(year, monthNumber, 1)))}><ChevronRight size={16} /></button>
          {props.mode === 'overview' && <button className="button calendar-open" onClick={props.onOpen}>Open Calendar</button>}
        </div>
      </div>
      <div className="calendar-display-controls">
        <div className="calendar-mode-toggle" role="group" aria-label="Calendar display">
          <button type="button" aria-pressed={qualityMode} disabled={saving} onClick={() => void changeMode('quality')}>Day quality</button>
          <button type="button" aria-pressed={!qualityMode} disabled={saving} onClick={() => void changeMode('hours')}>Hours</button>
        </div>
        <div className="calendar-legend" aria-label={qualityMode ? 'Day quality legend' : 'Hours legend'}>
          {qualityMode ? <>
            <span title="Good"><i className="quality-good" /><span className="sr-only">Good</span></span><span title="Steady"><i className="quality-steady" /><span className="sr-only">Steady</span></span><span title="Rough"><i className="quality-rough" /><span className="sr-only">Rough</span></span><span title="Unrated"><i className="neutral" /><span className="sr-only">Unrated</span></span>
          </> : <>
            <span><i className="neutral" />0h</span><span><i className="hours-light" />Under 2h</span><span><i className="hours-medium" />2–under 4h</span><span><i className="hours-dark" />4h+</span>
          </>}
        </div>
      </div>
      <div className="calendar-grid" role="group" aria-label="Monthly work calendar">
        {weekdays.map(day => <div className="weekday" key={day}>{day}</div>)}
        {cells.map((day, index) => {
          if (!day) return <div className="day-cell empty-cell" key={'empty-' + index} aria-hidden="true" />;
          const summary = calendarSummary(data, day, now);
          const { future } = summary;
          const label = displayDate(day) + (future ? ', future day' : ', ' + (qualityMode ? summary.ratingLabel + ', ' : '') + hoursLabel(summary.minutes) + ' worked');
          const content = <>
            <span className="day-number">{Number(day.slice(-2))}{day === today && <i />}</span>
            {!future && <>
              {!qualityMode && <strong>{hoursLabel(summary.minutes)}</strong>}
              <small>{qualityMode ? hoursLabel(summary.minutes) : summary.minutes ? 'Deep work' : 'No work'}</small>
            </>}
          </>;
          const className = 'day-cell ' + summary.color + (day === today ? ' today' : '') + (props.mode === 'interactive' && day === props.selectedDay ? ' selected' : '');
          return props.mode === 'overview'
            ? <div role="group" key={day} className={className} aria-label={label}>{content}</div>
            : <button type="button" key={day} className={className} onClick={() => props.onSelect(day)} aria-label={label}>{content}</button>;
        })}
      </div>
    </section>
  );
}

export function DayDetails({ data, day, now, mutate }: { data: AppData; day: DateKey; now: number; mutate: Mutate }) {
  const [cardDay, setCardDay] = useState<DateKey | null>(null);
  const [removing, setRemoving] = useState(false);
  const summary = dailySummary(data, day, now);
  const eligible = day <= dateKey(now) && dailyWorkedMinutes(data.sessions, day) > 0;
  const sessions = data.sessions.filter(item => (sessionDays(item)[day] ?? 0) > 0);
  return (
    <div className="day-details">
      <section className="panel day-summary">
        <div className="panel-heading"><h2>{displayDate(day)}</h2><span className={'result ' + summary.color}>{hoursLabel(summary.minutes)}</span></div>
        <div className="stat-line"><span>Deep work</span><strong>{hoursLabel(summary.minutes)}</strong></div>
        <div className="stat-line"><span>Sessions</span><strong>{sessions.length}</strong></div>
        {eligible && <button type="button" className="button" aria-haspopup="dialog" onClick={() => setCardDay(day)}>View day card</button>}
        {!eligible && data.dayCardBackgrounds[day] && <button type="button" className="button subtle" disabled={removing} onClick={async () => {
          setRemoving(true);
          try { await mutate(current => { const dayCardBackgrounds = { ...current.dayCardBackgrounds }; delete dayCardBackgrounds[day]; return { ...current, dayCardBackgrounds }; }); }
          catch { /* The shared error banner reports persistence failures. */ }
          finally { setRemoving(false); }
        }}>Remove day background</button>}
      </section>
      <DayRating key={day} data={data} day={day} now={now} mutate={mutate} />
      <JournalView data={data} day={day} mutate={mutate} />
      {cardDay && <DayCard key={cardDay} data={data} day={cardDay} mutate={mutate} onClose={() => setCardDay(null)} />}
    </div>
  );
}

function DayRating({ data, day, now, mutate }: { data: AppData; day: DateKey; now: number; mutate: Mutate }) {
  const [saving, setSaving] = useState(false);
  const future = day > dateKey(now);
  const rating = future ? null : data.dailyRatings[day] ?? null;
  const save = async (next: DayQuality | null) => {
    if (saving || future) return;
    setSaving(true);
    try { await mutate(current => setDayRating(current, day, next, Date.now())); }
    catch { /* The shared error banner reports persistence failures. */ }
    finally { setSaving(false); }
  };
  return <section className="panel day-rating-panel" aria-label="Rate your day">
    <div className="panel-heading"><h2>How was your day?</h2><span role="status">{saving ? 'Saving…' : future ? '' : rating ? dayQualityLabels[rating] : 'Unrated'}</span></div>
    {future ? <p className="muted">Rate this day when it arrives.</p> : <>
      <p className="muted">Your whole day, independent of work hours.</p>
      <div className="day-rating-options" role="group" aria-label="Day rating">
        {(['good', 'steady', 'rough'] as const).map(value => <button key={value} type="button" className={'button quality-' + value} aria-pressed={rating === value} disabled={saving} onClick={() => void save(value)}>{dayQualityLabels[value]}</button>)}
        <button type="button" className="button subtle" disabled={saving || rating === null} onClick={() => void save(null)}>Clear rating</button>
      </div>
    </>}
  </section>;
}
