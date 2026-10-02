import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dateKey, sessionDays } from '../domain.ts';
import { dailySummary, displayDate, hoursLabel } from '../ui.ts';
import type { Mutate } from '../ui.ts';
import type { AppData, DateKey } from '../types.ts';
import { JournalView } from './JournalView.tsx';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type CalendarProps = {
  data: AppData; now: number; month: DateKey; onMonth: (month: DateKey) => void;
} & (
  | { mode: 'overview'; onOpen: () => void }
  | { mode: 'interactive'; selectedDay: DateKey; onSelect: (day: DateKey) => void }
);

export function CalendarView(props: CalendarProps) {
  const { data, now, month, onMonth } = props;
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
      <div className="calendar-grid" role="group" aria-label="Monthly work calendar">
        {weekdays.map(day => <div className="weekday" key={day}>{day}</div>)}
        {cells.map((day, index) => {
          if (!day) return <div className="day-cell empty-cell" key={'empty-' + index} aria-hidden="true" />;
          const summary = dailySummary(data, day, now);
          const future = day > today;
          const noWorkPast = day < today && summary.minutes === 0;
          const label = future ? displayDate(day) + ', future day' : noWorkPast ? displayDate(day) + ', no work logged' : displayDate(day) + ', ' + hoursLabel(summary.minutes) + ' worked';
          const content = <>
            <span className="day-number">{Number(day.slice(-2))}{day === today && <i />}</span>
            <strong>{future || noWorkPast ? '—' : hoursLabel(summary.minutes)}</strong>
            {!future && !noWorkPast && <small>{summary.minutes ? 'Deep work' : 'Today'}</small>}
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
  const summary = dailySummary(data, day, now);
  const sessions = data.sessions.filter(item => (sessionDays(item)[day] ?? 0) > 0);
  return (
    <div className="day-details">
      <section className="panel day-summary">
        <div className="panel-heading"><h2>{displayDate(day)}</h2><span className={'result ' + summary.color}>{hoursLabel(summary.minutes)}</span></div>
        <div className="stat-line"><span>Deep work</span><strong>{hoursLabel(summary.minutes)}</strong></div>
        <div className="stat-line"><span>Sessions</span><strong>{sessions.length}</strong></div>
      </section>
      <JournalView data={data} day={day} mutate={mutate} />
    </div>
  );
}
