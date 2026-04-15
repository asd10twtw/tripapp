
import { Member, EventCategory, ScheduleEvent, Expense, TodoItem } from './types';

export const THEME_COLOR = '#38BDF8'; 
export const BG_COLOR = '#F8FAFC'; 
export const SOFT_SHADOW = '0 10px 25px -5px rgba(56, 189, 248, 0.15)';

export const EXCHANGE_RATE = 0.024; 

export const MEMBERS: Member[] = [
  { id: 'm1', name: '我', color: 'bg-sky-400', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aria' },
  { id: 'm2', name: '旅伴A', color: 'bg-rose-400', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bella' },
  { id: 'm3', name: '旅伴B', color: 'bg-amber-400', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chloe' },
  { id: 'm4', name: '旅伴C', color: 'bg-emerald-400', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dora' },
  { id: 'm5', name: '旅伴D', color: 'bg-indigo-400', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma' },
];

export const CATEGORY_COLORS: Record<string, string> = {
  [EventCategory.SIGHTSEEING]: 'bg-sky-50 text-sky-400 border-sky-100',
  [EventCategory.FOOD]: 'bg-rose-50 text-rose-400 border-rose-100',
  [EventCategory.TRANSPORT]: 'bg-slate-50 text-slate-400 border-slate-100',
  [EventCategory.STAY]: 'bg-indigo-50 text-indigo-400 border-indigo-100',
  [EventCategory.SHOPPING]: 'bg-amber-50 text-amber-400 border-amber-100',
  [EventCategory.STAR]: 'bg-purple-50 text-purple-400 border-purple-100',
};

export const CATEGORY_ICONS: Record<string, string> = {
  [EventCategory.SIGHTSEEING]: '🎡',
  [EventCategory.FOOD]: '🍜',
  [EventCategory.TRANSPORT]: '✈️',
  [EventCategory.STAY]: '🏨',
  [EventCategory.SHOPPING]: '🛍️',
  [EventCategory.STAR]: '🌟',
};

export const MOCK_EVENTS: ScheduleEvent[] = [];
export const MOCK_EXPENSES: Expense[] = [];
export const MOCK_TODOS: TodoItem[] = [];
