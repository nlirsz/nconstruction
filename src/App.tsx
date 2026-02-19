import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { GanttView } from './components/GanttView';
import { DailyReport } from './components/DailyReport';
import { ProjectsManager } from './components/ProjectsManager';
import { UnitProgress } from './components/UnitProgress';
import { ExecutionTab } from './components/ExecutionTab';
import { ReportsTab } from './components/ReportsTab';
import { CalendarView } from './components/CalendarView';
import { ProjectSettings } from './components/ProjectSettings';
import { NotesTab } from './components/NotesTab';
import { SuppliesTab } from './components/SuppliesTab';
import { DocumentsTab } from './components/DocumentsTab';
import { AsBuiltTab } from './components/AsBuiltTab';
import { GalleryTab } from './components/GalleryTab';
import { Login } from './components/Login';
import { CustomerDashboard } from './components/CustomerDashboard';
import { OrganizationSetup } from './components/OrganizationSetup';
import { OrganizationSettings } from './components/OrganizationSettings';
import { Project, Task, UserProfile, Organization, TaskStatus, UnitPermission } from './types';
import { Menu, Database, Copy, Check, X, AlertTriangle, Bell, User as UserIcon } from 'lucide-react';
import { supabase } from './services/supabaseClient';
import { NotificationCenter } from './components/NotificationCenter';
import { UserProfileModal } from './components/UserProfile';
import { APP_LOGO_URL } from './constants';
import { parseLocalDate, formatLocalDate, addDays, diffDays } from './utils/dateUtils';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [isOrgSettingsOpen, setIsOrgSettingsOpen] = useState(false);
  const [isOrgCreateOpen, setIsOrgCreateOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [targetUnitId, setTargetUnitId] = useState<string | null>(null);
  const [targetPhaseId, setTargetPhaseId] = useState<string | null>(null);
  const [userProjectPermission, setUserProjectPermission] = useState<UnitPermission | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [loadingPermission, setLoadingPermission] = useState(false);

  // Use ref to track data loading status to avoid stale closure issues in auth listener
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoadingSession(false); // Only critical for first load

      if (session) {
        const userId = session.user.id;
        await Promise.all([
          fetchUserProfile(userId),
          fetchOrganizations(userId)
        ]);
      } else {
        setLoadingProjects(false);
        setLoadingOrgs(false);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_IN') {
        fetchUserProfile(session!.user.id);
        fetchOrganizations(session!.user.id);
      } else if (event === 'SIGNED_OUT') {
        setLoadingSession(false);
        setLoadingOrgs(false);
        setLoadingProjects(false);
        setSelectedProject(null);
        setProjects([]);
        setTasks([]);
        setUserProfile(null);
        setOrganizations([]);
        setCurrentOrganization(null);
        setActiveTab('dashboard');
        dataLoadedRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setUserProfile(data);
  };

  const fetchOrganizations = async (userId: string) => {
    // Only show loading if we haven't loaded data yet (check ref to avoid stale closure)
    if (!dataLoadedRef.current) setLoadingOrgs(true);

    try {
      const { data } = await supabase.from('organizations').select('*');
      if (data && data.length > 0) {
        setOrganizations(data);
        setCurrentOrganization(data[0]);
      } else {
        setOrganizations([]);
        setCurrentOrganization(null);
      }
    } catch (error) {
      console.error("Failed to fetch organizations", error);
    } finally {
      // Don't set loadingOrgs to false here, wait for projects to fetch
      // But if we didn't set it to true (refresh), we don't need to worry?
      // Actually, we pass through to fetchProjects regardless
      fetchProjects();
    }
  };

  const fetchUserPermission = async (projectId: string) => {
    if (!session?.user?.id || !projectId) return;
    const userId = session.user.id;
    const userEmail = session.user.email?.toLowerCase();

    const { data } = await supabase
      .from('unit_permissions')
      .select('*, unit:project_units(name)')
      .eq('project_id', projectId)
      .or(`user_id.eq.${userId}${userEmail ? `,email.eq."${userEmail}"` : ''}`)
      .eq('is_active', true)
      .maybeSingle();

    if (data) {
      // Auto-link user_id if it's missing (claiming the invite)
      if (!data.user_id) {
        await supabase.from('unit_permissions').update({ user_id: userId }).eq('id', data.id);
      }
      setUserProjectPermission(data as UnitPermission);
    } else {
      setUserProjectPermission(null);
    }
  };

  const fetchProjects = async () => {
    if (!session?.user) {
      setLoadingProjects(false);
      setLoadingOrgs(false);
      return;
    }

    // Only show full loading if we haven't loaded data yet
    if (!dataLoadedRef.current) setLoadingProjects(true);

    const userId = session.user.id;
    const userEmail = session.user.email?.toLowerCase();

    try {
      // Buscar tudo em uma pancada só
      const { data: myOrgs } = await supabase.from('organizations').select('id');
      const orgIds = (myOrgs || []).map(o => o.id);

      const [ownedRes, orgRes, memberRes, permRes] = await Promise.all([
        supabase.from('projects').select('*').eq('user_id', userId),
        orgIds.length > 0 ? supabase.from('projects').select('*').in('organization_id', orgIds) : Promise.resolve({ data: [] }),
        supabase.from('project_members').select('project_id').eq('user_id', userId),
        supabase.from('unit_permissions').select('project_id').or(`user_id.eq.${userId}${userEmail ? `,email.eq."${userEmail}"` : ''}`)
      ]);

      const guestIds = [
        ...(memberRes.data || []).map((r: any) => r.project_id),
        ...(permRes.data || []).map((r: any) => r.project_id)
      ];

      let extraProjects: any[] = [];
      if (guestIds.length > 0) {
        const { data } = await supabase.from('projects').select('*').in('id', guestIds);
        extraProjects = data || [];
      }

      const map = new Map();
      [...(ownedRes.data || []), ...(orgRes.data || []), ...extraProjects].forEach(p => {
        if (p && p.id) map.set(p.id, p);
      });

      const mapped = Array.from(map.values()).map((p: any) => ({
        id: p.id,
        organization_id: p.organization_id,
        name: p.name,
        address: p.address,
        progress: p.progress,
        budgetConsumed: p.budget_consumed,
        status: p.status,
        residentEngineer: p.resident_engineer,
        imageUrl: p.image_url,
        themeColor: p.theme_color,
        structure: p.structure,
        phases: p.phases,
        startDate: p.start_date,
        endDate: p.end_date,
        deliveryFormat: p.delivery_format,
        user_id: p.user_id
      }));

      const combined = mapped.sort((a, b) => a.name.localeCompare(b.name));
      setProjects(combined);

      // Auto-select project if user has only one project and is not staff
      // This is a rough check, but helps with the 'flashing' issue for clients
      const hasNoOrgs = organizations.length === 0;
      const hasOnlyOneProject = combined.length === 1;
      const ownsNoProjects = !combined.some(p => p.user_id === userId);

      if (hasNoOrgs && ownsNoProjects && hasOnlyOneProject && !selectedProject) {
        setSelectedProject(combined[0]);
      }

      if (selectedProject) {
        const updated = mapped.find(p => p.id === selectedProject.id);
        if (updated) setSelectedProject(updated);
      }
    } catch (error) {
      console.error("Erro ao buscar projetos:", error);
    } finally {
      dataLoadedRef.current = true;
      setLoadingProjects(false);
      setLoadingOrgs(false);
    }
  };

  const fetchTasks = async (projectId?: string) => {
    try {
      let query = supabase.from('tasks').select('*');
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query;
      if (!error) {
        setTasks(data.map((t: any) => ({
          id: t.id,
          projectId: t.project_id,
          name: t.name,
          customId: t.custom_id,
          description: t.description,
          start: t.start,
          end: t.end,
          progress: t.progress,
          status: t.status,
          dependencies: t.dependencies,
          assignedTo: t.assigned_to,
          imageUrl: t.image_url,
          linked_unit_id: t.linked_unit_id,
          linked_phase_id: t.linked_phase_id,
          linked_subtasks: t.linked_subtasks
        })));
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (selectedProject) {
      // If we already have permissions for this project, don't show loading screen
      // This prevents flashing when focusing window or minor session updates
      if (userProjectPermission?.project_id === selectedProject.id) {
        fetchTasks(selectedProject.id);
        return;
      }

      setLoadingPermission(true);
      Promise.all([
        fetchTasks(selectedProject.id),
        fetchUserPermission(selectedProject.id)
      ]).finally(() => {
        setLoadingPermission(false);
      });
    } else if (session?.user?.id) {
      fetchProjects();
      setUserProjectPermission(null);
    }
  }, [selectedProject?.id, session?.user?.id]);

  const handleAddProject = async (project: Omit<Project, 'id' | 'progress' | 'budgetConsumed' | 'status'>) => {
    const { data, error } = await supabase.from('projects').insert({
      name: project.name,
      address: project.address,
      resident_engineer: project.residentEngineer,
      image_url: project.imageUrl,
      theme_color: project.themeColor,
      start_date: project.startDate,
      end_date: project.endDate,
      delivery_format: project.deliveryFormat,
      organization_id: project.organization_id,
      progress: 0,
      budget_consumed: 0,
      status: 'green',
      user_id: session.user.id
    }).select().single();
    if (!error && data) fetchProjects();
  };

  const handleUpdateProject = async (project: Project) => {
    const { error } = await supabase.from('projects').update({
      name: project.name,
      address: project.address,
      resident_engineer: project.residentEngineer,
      image_url: project.imageUrl,
      theme_color: project.themeColor,
      structure: project.structure,
      phases: project.phases,
      start_date: project.startDate,
      end_date: project.endDate,
      delivery_format: project.deliveryFormat,
      organization_id: project.organization_id
    }).eq('id', project.id);
    if (!error) fetchProjects();
  };

  const handleDeleteProject = async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (!error) {
      setProjects(projects.filter(p => p.id !== id));
      if (selectedProject?.id === id) setSelectedProject(null);
    }
  };

  const handleAddTask = async (task: Omit<Task, 'id'>) => {
    const { error } = await supabase.from('tasks').insert({
      project_id: task.projectId,
      name: task.name,
      start: task.start,
      end: task.end,
      progress: task.progress,
      status: task.status
    });
    if (!error && selectedProject) fetchTasks(selectedProject.id);
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    const { error } = await supabase.from('tasks').update({
      name: updatedTask.name,
      start: updatedTask.start,
      end: updatedTask.end,
      progress: updatedTask.progress,
      status: updatedTask.status,
      linked_unit_id: updatedTask.linked_unit_id,
      linked_phase_id: updatedTask.linked_phase_id,
      linked_subtasks: updatedTask.linked_subtasks
    }).eq('id', updatedTask.id);
    if (!error && selectedProject) {
      if (updatedTask.linked_unit_id && updatedTask.linked_phase_id) {
        const { data: existingProgress } = await supabase.from('unit_progress').select('*').eq('unit_id', updatedTask.linked_unit_id).eq('phase_id', updatedTask.linked_phase_id).maybeSingle();
        const updatedSubtasks = updatedTask.linked_subtasks || [];
        if (existingProgress) {
          await supabase.from('unit_progress').update({ subtasks: updatedSubtasks, updated_at: new Date().toISOString() }).eq('id', existingProgress.id);
        } else {
          await supabase.from('unit_progress').insert({ project_id: updatedTask.projectId, unit_id: updatedTask.linked_unit_id, phase_id: updatedTask.linked_phase_id, subtasks: updatedSubtasks, updated_at: new Date().toISOString() });
        }
      }
      fetchTasks(selectedProject.id);
    }
  };

  const handleDeleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error && selectedProject) fetchTasks(selectedProject.id);
  };

  const handleNavigateToExecution = (unitId: string, phaseId?: string) => {
    setTargetUnitId(unitId);
    setTargetPhaseId(phaseId || null);
    setActiveTab('execution');
  };

  // Determine if user is guest (client/architect) for current project
  const isGuestUser = (() => {
    if (!selectedProject || !userProjectPermission) return false;
    const isOwner = selectedProject.user_id === session?.user?.id;
    const isOrgMember = organizations.some(o => o.id === selectedProject.organization_id);
    const isAdminRole = userProjectPermission?.role === 'admin';
    const isStaff = isOwner || isOrgMember || isAdminRole;
    return !isStaff && (userProjectPermission.role === 'client' || userProjectPermission.role === 'architect');
  })();

  const renderContent = () => {
    if (!selectedProject) return null;

    if (isGuestUser && userProjectPermission) {
      return (
        <CustomerDashboard
          project={selectedProject}
          projects={projects}
          permission={userProjectPermission}
          userProfile={userProfile}
          onLogout={() => { setSelectedProject(null); supabase.auth.signOut(); }}
          onSelectProject={(p) => setSelectedProject(p)}
          session={session}
        />
      );
    }

    const projectTasks = tasks.filter(t => t.projectId === selectedProject.id);
    switch (activeTab) {
      case 'gantt': return <GanttView tasks={projectTasks} projects={[selectedProject]} onAddTask={handleAddTask} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} />;
      case 'execution': return <ExecutionTab project={selectedProject} userProfile={userProfile} currentUser={session?.user} initialUnitId={targetUnitId} initialPhaseId={targetPhaseId} onClearInitialUnit={() => { setTargetUnitId(null); setTargetPhaseId(null); }} onUpdateProgress={(p) => setSelectedProject({ ...selectedProject, progress: p })} />;
      case 'reports': return <ReportsTab project={selectedProject} userProfile={userProfile} organization={currentOrganization} />;
      case 'units': return <UnitProgress project={selectedProject} currentUser={session.user} userProfile={userProfile} onUpdateProgress={(p) => setSelectedProject({ ...selectedProject, progress: p })} onNavigateToExecution={handleNavigateToExecution} />;
      case 'notes': return <NotesTab project={selectedProject} currentUser={session?.user} userProfile={userProfile} />;
      case 'calendar': return <CalendarView project={selectedProject} />;
      case 'rdo': return <DailyReport tasks={tasks} projects={[selectedProject]} onAddTask={handleAddTask} />;
      case 'gallery': return <GalleryTab project={selectedProject} currentUser={session.user} />;
      case 'settings': return <ProjectSettings project={selectedProject} onUpdateProject={handleUpdateProject} organizations={organizations} currentUser={session?.user} />;
      case 'supplies': return <SuppliesTab project={selectedProject} currentUser={session?.user} userProfile={userProfile} />;
      case 'documents': return <DocumentsTab project={selectedProject} currentUser={session?.user} userProfile={userProfile} />;
      case 'asbuilt': return <AsBuiltTab project={selectedProject} currentUser={session?.user} />;
      default: return <Dashboard project={selectedProject} tasks={projectTasks} setActiveTab={setActiveTab} onNavigateToExecution={handleNavigateToExecution} />;
    }
  };

  if (loadingSession) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">Verificando sessão...</div>;
  if (!session) return <Login />;

  if (!loadingOrgs && !loadingProjects && !loadingSession) {
    const hasAnyOrg = organizations.length > 0;
    const hasAnyProject = projects.length > 0;
    const isMainAdmin = session.user.email === 'luhrsnicolas@gmail.com' || session.user.email === 'teste@teste.com';
    const isPotentiallyClient = !hasAnyOrg && hasAnyProject;

    // Only show Organization Setup if we are SURE user is not a client with projects
    if (!hasAnyOrg && !hasAnyProject && !isMainAdmin && !isPotentiallyClient) {
      return <OrganizationSetup currentUser={session.user} onOrganizationCreated={(org) => { setOrganizations([org]); setCurrentOrganization(org); fetchProjects(); }} />;
    }
  } else {
    // Show loading while ANY critical data is fetching
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">Carregando ambiente...</div>;
  }

  if (!selectedProject) {
    return (
      <div className="min-h-screen bg-slate-50">
        <ProjectsManager projects={projects} tasks={tasks} currentUser={session.user} organizations={organizations} currentOrganization={currentOrganization} onAddProject={handleAddProject} onUpdateProject={handleUpdateProject} onDeleteProject={handleDeleteProject} onSelectProject={(p) => { setSelectedProject(p); setActiveTab('dashboard'); }} onOpenProfile={() => setIsProfileOpen(true)} userProfile={userProfile} onRefresh={fetchProjects} onCreateOrganization={() => setIsOrgCreateOpen(true)} />
        {isProfileOpen && <UserProfileModal session={session} isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} onProfileUpdate={setUserProfile} />}
      </div>
    );
  }

  // Prevent flash while determining role
  if (loadingPermission) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">Carregando permissões...</div>;
  }

  // CLIENT/ARCHITECT: Render CustomerDashboard fullscreen (no staff sidebar)
  if (isGuestUser) {
    return renderContent();
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <header className={`fixed top-0 left-0 right-0 h-14 bg-slate-900 border-b border-white/10 z-[130] flex xl:hidden items-center justify-between px-3 shadow-lg`}>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsSidebarOpen(true)} className="p-1.5 text-white hover:bg-white/10 rounded-lg transition-colors"><Menu size={20} /></button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white rounded border border-slate-100 p-0.5 overflow-hidden">
              <img src={currentOrganization?.logo_url || APP_LOGO_URL} alt="Org" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-white leading-tight truncate max-w-[100px]">{selectedProject.name}</span>
              <span className="text-[9px] font-bold text-white/70 uppercase tracking-tighter">{activeTab}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <NotificationCenter projects={projects} onSelectProject={setSelectedProject} currentUser={session.user} iconClassName="text-white hover:bg-white/10" />
          <button onClick={() => setIsProfileOpen(true)} className="w-7 h-7 rounded-full border border-white/20 overflow-hidden">
            {userProfile?.avatar_url ? <img src={userProfile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-white/10 text-white"><UserIcon size={14} /></div>}
          </button>
        </div>
      </header>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} project={selectedProject} onBack={() => setSelectedProject(null)} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} userProfile={userProfile} onOpenProfile={() => setIsProfileOpen(true)} organization={currentOrganization} onOpenOrgSettings={() => setIsOrgSettingsOpen(true)} />
      <main className={`px-2 pb-4 pt-16 md:pt-20 md:px-4 md:pb-6 xl:pt-6 min-h-screen ${isSidebarCollapsed ? 'xl:ml-20' : 'xl:ml-64'}`}>
        <div className="w-full max-w-[1400px] mx-auto">{renderContent()}</div>
      </main>
      {isProfileOpen && <UserProfileModal session={session} isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} onProfileUpdate={setUserProfile} />}
      {isOrgSettingsOpen && currentOrganization && <OrganizationSettings organization={currentOrganization} onClose={() => setIsOrgSettingsOpen(false)} onUpdate={setCurrentOrganization} currentUser={session.user} />}
      {isOrgCreateOpen && <OrganizationSetup variant="modal" currentUser={session.user} onClose={() => setIsOrgCreateOpen(false)} onOrganizationCreated={(org) => { setOrganizations([...organizations, org]); setCurrentOrganization(org); setIsOrgCreateOpen(false); }} />}
    </div>
  );
};
export default App;