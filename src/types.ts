
/* Fix: Define TaskStatus enum used for task tracking across components */
export enum TaskStatus {
  NOT_STARTED = 'Não Iniciado',
  IN_PROGRESS = 'Em Andamento',
  COMPLETED = 'Concluído'
}

/* Fix: Define WeatherCondition enum used in DailyReport and weather services */
export enum WeatherCondition {
  SUNNY = 'ensolarado',
  CLOUDY = 'nublado',
  RAINY = 'chuvoso',
  STORM = 'tempestade'
}

/* Fix: Define LevelType for building structure levels */
export type LevelType = 'foundation' | 'basement' | 'garage' | 'common' | 'apartments' | 'roof';

/* Fix: Define UnitConfig for individual room/unit metadata */
export interface UnitConfig {
  id: string;
  name: string;
  type: 'unit' | 'common' | 'garage' | 'commercial';
}

/* Fix: Define LevelConfig for building floor settings */
export interface LevelConfig {
  id: string;
  label: string;
  type: LevelType;
  order: number;
  units: UnitConfig[];
  activePhases?: string[];
}

/* Fix: Define ProjectStructure for overall building configuration */
export interface ProjectStructure {
  floors: number;
  unitsPerFloor: number;
  hasFoundation?: boolean;
  basements?: number;
  levels?: LevelConfig[];
}

/* Fix: Define PhaseConfig for construction stages (e.g., Structure, Masonry) */
export interface PhaseConfig {
  id: string;
  label: string;
  code: string;
  color: string;
  icon: string;
  subtasks: string[];
}

/* Fix: Define Project interface with all optional and required fields */
export interface Project {
  id: string;
  organization_id?: string;
  name: string;
  address: string;
  progress: number;
  budgetConsumed: number;
  status: 'green' | 'yellow' | 'red';
  residentEngineer: string;
  imageUrl: string;
  themeColor: string;
  structure?: ProjectStructure;
  phases?: PhaseConfig[];
  startDate?: string;
  endDate?: string;
  user_id?: string;
}

/* Fix: Define Task interface for Gantt and execution tracking */
export interface Task {
  id: string;
  projectId: string;
  name: string;
  customId?: string;
  description?: string;
  start: string;
  end: string;
  progress: number;
  status: TaskStatus | string;
  dependencies?: string[];
  assignedTo?: string;
  imageUrl?: string;
  linked_unit_id?: string;
  linked_phase_id?: string;
  linked_subtasks?: string[];
}

/* Fix: Define UserProfile for member management and avatars */
export interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string;
  role: string;
}

/* Fix: Define Organization for multi-tenant structure */
export interface Organization {
  id: string;
  name: string;
  cnpj?: string;
  logo_url?: string;
  owner_id: string;
  created_at?: string;
}

/* Fix: Define LogEntry for audit trails and daily updates */
export interface LogEntry {
  id: string;
  project_id: string;
  category: 'unit' | 'macro' | 'system';
  title: string;
  details: string;
  previous_value?: number;
  new_value?: number;
  observation?: string;
  user_name?: string;
  user_avatar?: string;
  image_url?: string;
  date: string;
}

/* Fix: Define NoteStatus and Note interface for field observations */
export type NoteStatus = 'pending' | 'in_progress' | 'blocked' | 'completed';

export interface Note {
  id: string;
  project_id: string;
  title?: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  status: NoteStatus;
  assigned_to?: string;
  created_by: string;
  due_date?: string;
  context?: string;
  attachments?: string[];
  project_note_replies?: any[];
  created_at: string;
  is_completed?: boolean;
}

/* Fix: Define Supply types for logistics module */
export interface SupplyItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
}

export type SupplyStatus = 'requested' | 'approved' | 'separating' | 'delivering' | 'delivered' | 'cancelled';
export type SupplyPriority = 'low' | 'medium' | 'high';

export interface SupplyOrder {
  id: string;
  project_id: string;
  title: string;
  priority: SupplyPriority;
  items: SupplyItem[];
  status: SupplyStatus;
  created_by: string;
  created_at: string;
  supply_comments?: SupplyComment[];
}

export interface SupplyComment {
  id: string;
  order_id: string;
  content: string;
  created_by: string;
  created_at: string;
}

/* Fix: Define Photo types for gallery management */
export type PhotoCategory = 'evolution' | 'structural' | 'installations' | 'finishing' | 'inspection' | 'other';

export interface ProjectPhoto {
  id: string;
  project_id: string;
  url: string;
  description: string;
  category: PhotoCategory;
  location_label: string;
  created_by?: string;
  created_at: string;
}

/* Fix: Define ProjectInvite for team collaboration */
export interface ProjectInvite {
  id: string;
  project_id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'declined';
  invited_by?: string;
  created_at: string;
}

/* Fix: Define Notification for real-time alerts */
export interface Notification {
  id: string;
  project_id?: string;
  content: string;
  is_read: boolean;
  created_by: string;
  created_at: string;
}

/* Fix: Define Document types for tech library */
export type DocumentCategory = 'structural' | 'architectural' | 'electrical' | 'hydraulic' | 'finishing' | 'others';

export interface ProjectDocument {
  id: string;
  project_id: string;
  title: string;
  category: DocumentCategory;
  context?: string;
  file_url: string;
  file_type: string;
  created_by: string;
  created_at: string;
}

/* Fix: Define Drawing and Measurement for As-Built module */
export interface Drawing {
  id: string;
  project_id: string;
  title: string;
  context: string;
  geometry_data: {
    meta: { width: number, height: number },
    geometry: any[]
  };
}

export interface Measurement {
  id: string;
  drawing_id: string;
  segment_id: string;
  real_value: number;
  status: 'ok' | 'error';
  updated_at: string;
}

/* Fix: Define Organization types for account setup */
export interface OrganizationInvite {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'declined';
  invited_by?: string;
  created_at: string;
  organization?: Organization;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles?: UserProfile;
}

/* Fix: Define technical audit verification types */
export type VerificationStatus = 'ok' | 'pending' | 'warning';

export interface UnitVerification {
    id: string;
    unit_id: string;
    phase_id: string;
    subtask_name: string;
    status: VerificationStatus;
    comment?: string;
    image_url?: string;
    verified_by: string;
    verified_at: string;
}
