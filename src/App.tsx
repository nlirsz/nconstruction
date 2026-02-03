import React, { useState, useEffect } from 'react';
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
import { OrganizationSetup } from './components/OrganizationSetup';
import { OrganizationSettings } from './components/OrganizationSettings'; 
import { Project, Task, UserProfile, Organization, TaskStatus } from './types';
import { Menu, Database, Copy, Check, X, AlertTriangle, Bell, User as UserIcon } from 'lucide-react';
import { supabase } from './services/supabaseClient';
import { NotificationCenter } from './components/NotificationCenter';
import { UserProfileModal } from './components/UserProfile';
import { APP_LOGO_URL } from './constants';

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
      if (session) {
          fetchUserProfile(session.user.id);
          fetchOrganizations(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
          fetchUserProfile(session.user.id);
          fetchOrganizations(session.user.id);
      } else {
          setSelectedProject(null);
          setProjects([]);
          setTasks([]);
          setUserProfile(null);
          setOrganizations([]);
          setCurrentOrganization(null);
          setActiveTab('dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (data) setUserProfile(data);
  };

  const fetchOrganizations = async (userId: string) => {
      setLoadingOrgs(true);
      try {
          const { data, error } = await supabase.from('organizations').select('*');
          if (error) {
              setOrganizations([]);
              setCurrentOrganization(null);
          } else if (data && data.length > 0) {
              setOrganizations(data);
              setCurrentOrganization(prev => (prev && data.find(o => o.id === prev.id)) ? prev : data[0]);
          } else {
              setOrganizations([]);
              setCurrentOrganization(null);
          }
      } catch (error) {
          console.error("Failed to fetch organizations", error);
      } finally {
          setLoadingOrgs(false);
      }
  };

  useEffect(() => {
      if (session) {
          fetchProjects();
          fetchTasks();
      }
  }, [session]);

  const fetchProjects = async () => {
      if (!session?.user) return;
      const userId = session.user.id;
      try {
          const { data: ownedProjects } = await supabase.from('projects').select('*').eq('user_id', userId);
          const { data: memberRows } = await supabase.from('project_members').select('project_id').eq('user_id', userId);
          const memberProjectIds = (memberRows || []).map((row: any) => row.project_id);
          
          let guestProjects: any[] = [];
          if (memberProjectIds.length > 0) {
              const { data } = await supabase.from('projects').select('*').in('id', memberProjectIds);
              guestProjects = data || [];
          }

          const uniqueProjectsMap = new Map();
          [...(ownedProjects || []), ...guestProjects].forEach(p => {
              if (p && p.id) uniqueProjectsMap.set(p.id, p);
          });

          const mappedProjects: Project[] = Array.from(uniqueProjectsMap.values()).map((p: any) => ({
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
              user_id: p.user_id
          }));
          
          setProjects(mappedProjects);
          if (selectedProject) {
              const updated = mappedProjects.find(p => p.id === selectedProject.id);
              if (updated) setSelectedProject(updated);
          }
      } catch (error) {
          console.error("Erro crítico ao buscar projetos:", error);
      }
  };

  const fetchTasks = async () => {
      try {
        const { data, error } = await supabase.from('tasks').select('*');
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

  const handleAddProject = async (newProject: Project) => {
    const { error } = await supabase.from('projects').insert({
        organization_id: currentOrganization?.id || null,
        name: newProject.name,
        address: newProject.address,
        resident_engineer: newProject.residentEngineer,
        progress: newProject.progress,
        budget_consumed: newProject.budgetConsumed,
        status: newProject.status,
        image_url: newProject.imageUrl,
        theme_color: newProject.themeColor,
        structure: newProject.structure,
        phases: newProject.phases,
        start_date: newProject.startDate,
        end_date: newProject.endDate,
        user_id: session.user.id
    });
    if (!error) fetchProjects();
  };

  const handleUpdateProject = async (updatedProject: Project) => {
    const { error } = await supabase.from('projects').update({
        organization_id: updatedProject.organization_id,
        name: updatedProject.name,
        address: updatedProject.address,
        resident_engineer: updatedProject.residentEngineer,
        progress: updatedProject.progress,
        budget_consumed: updatedProject.budgetConsumed,
        status: updatedProject.status,
        image_url: updatedProject.imageUrl,
        theme_color: updatedProject.themeColor,
        structure: updatedProject.structure,
        phases: updatedProject.phases,
        start_date: updatedProject.startDate,
        end_date: updatedProject.endDate
    }).eq('id', updatedProject.id);

    if (!error) fetchProjects();
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm("Confirmar exclusão definitiva da obra?")) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (!error) {
        setProjects(prev => prev.filter(p => p.id !== id));
        if (selectedProject?.id === id) setSelectedProject(null);
    }
  };

  const handleAddTask = async (newTask: Task) => {
    const { error } = await supabase.from('tasks').insert({
        project_id: newTask.projectId,
        name: newTask.name,
        custom_id: newTask.customId,
        description: newTask.description,
        start: newTask.start,
        end: newTask.end,
        progress: newTask.progress || 0,
        status: newTask.status || 'Não Iniciado',
        dependencies: newTask.dependencies,
        assigned_to: newTask.assignedTo,
        image_url: newTask.imageUrl,
        linked_unit_id: newTask.linked_unit_id,
        linked_phase_id: newTask.linked_phase_id,
        linked_subtasks: newTask.linked_subtasks
    });
    if (!error) fetchTasks();
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    const { error } = await supabase.from('tasks').update({
        name: updatedTask.name,
        custom_id: updatedTask.customId,
        description: updatedTask.description,
        start: updatedTask.start,
        end: updatedTask.end,
        progress: updatedTask.progress,
        status: updatedTask.status,
        dependencies: updatedTask.dependencies,
        assigned_to: updatedTask.assignedTo,
        image_url: updatedTask.imageUrl,
        linked_unit_id: updatedTask.linked_unit_id,
        linked_phase_id: updatedTask.linked_phase_id,
        linked_subtasks: updatedTask.linked_subtasks
    }).eq('id', updatedTask.id);
    if (!error) fetchTasks();
  };

  const handleDeleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) fetchTasks();
  };

  const handleNavigateToExecution = (unitId: string, phaseId?: string) => {
      setTargetUnitId(unitId);
      setTargetPhaseId(phaseId || null);
      setActiveTab('execution');
  };

  const renderContent = () => {
    if (!selectedProject) return null;
    const projectTasks = tasks.filter(t => t.projectId === selectedProject.id);

    switch (activeTab) {
      case 'dashboard': return <Dashboard project={selectedProject} tasks={projectTasks} setActiveTab={setActiveTab} onNavigateToExecution={handleNavigateToExecution} />;
      case 'gantt': return <GanttView tasks={projectTasks} projects={[selectedProject]} onAddTask={handleAddTask} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} />;
      case 'execution': return (
        <ExecutionTab 
            project={selectedProject} 
            userProfile={userProfile} 
            currentUser={session?.user} 
            initialUnitId={targetUnitId} 
            initialPhaseId={targetPhaseId}
            onClearInitialUnit={() => { setTargetUnitId(null); setTargetPhaseId(null); }} 
            onUpdateProgress={(p) => setSelectedProject({...selectedProject, progress: p})} 
        />
      );
      case 'reports': return <ReportsTab project={selectedProject} userProfile={userProfile} organization={currentOrganization} />;
      case 'units': return <UnitProgress project={selectedProject} currentUser={session.user} userProfile={userProfile} onUpdateProgress={(p) => setSelectedProject({...selectedProject, progress: p})} onNavigateToExecution={handleNavigateToExecution} />;
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

  if (loadingSession) return <div className="flex h-screen items-center justify-center bg-slate-100 text-slate-500">Carregando...</div>;
  if (!session) return <Login />;

  if (!loadingOrgs && organizations.length === 0) {
      return <OrganizationSetup currentUser={session.user} onOrganizationCreated={(org) => { setOrganizations([org]); setCurrentOrganization(org); fetchProjects(); }} />;
  }

  if (!selectedProject) {
      return (
        <div className="min-h-screen bg-slate-50">
             <ProjectsManager 
                projects={projects} 
                tasks={tasks} 
                currentUser={session.user} 
                organizations={organizations} 
                currentOrganization={currentOrganization} 
                onAddProject={handleAddProject} 
                onUpdateProject={handleUpdateProject} 
                onDeleteProject={handleDeleteProject} 
                onSelectProject={(p) => { setSelectedProject(p); setActiveTab('dashboard'); }} 
                onOpenProfile={() => setIsProfileOpen(true)} 
                userProfile={userProfile} 
                onRefresh={fetchProjects} 
                onCreateOrganization={() => setIsOrgCreateOpen(true)} 
             />
             {isProfileOpen && <UserProfileModal session={session} isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} onProfileUpdate={setUserProfile} />}
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <header className={`fixed top-0 left-0 right-0 h-14 bg-slate-900 border-b border-white/10 z-[130] flex xl:hidden items-center justify-between px-3 shadow-lg`}>
          <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Abrir Menu"
              >
                  <Menu size={20} />
              </button>
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
                  {userProfile?.avatar_url ? (
                      <img src={userProfile.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/10 text-white"><UserIcon size={14} /></div>
                  )}
              </button>
          </div>
      </header>

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        project={selectedProject} 
        onBack={() => setSelectedProject(null)} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        isCollapsed={isSidebarCollapsed} 
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        userProfile={userProfile} 
        onOpenProfile={() => setIsProfileOpen(true)} 
        organization={currentOrganization} 
        onOpenOrgSettings={() => setIsOrgSettingsOpen(true)} 
      />
      
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