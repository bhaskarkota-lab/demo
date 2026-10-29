"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  Compass,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { Toaster, toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  initialProjects,
  initialTasks,
  projectById,
  teamMembers,
  type ProjectStatus,
  type WorkspaceProject,
  type WorkspaceTask,
} from "@/lib/workspace-data";

const projectSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters."),
  client: z.string().trim().min(2, "Enter a client or team name."),
  dueDate: z.string().min(1, "Choose a target date."),
});

const taskSchema = z.object({
  title: z.string().trim().min(3, "Enter at least 3 characters."),
  projectId: z.string().min(1, "Choose a project."),
  dueDate: z.string().min(1, "Choose a due date."),
  priority: z.enum(["High", "Medium", "Low"]),
  assignee: z.string().min(1, "Choose a teammate."),
});

type ProjectFormValues = z.infer<typeof projectSchema>;
type TaskFormValues = z.infer<typeof taskSchema>;
type View = "overview" | "projects" | "tasks";
type DialogView = "project" | "task" | null;

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "tasks", label: "My tasks", icon: ListTodo },
];

const avatarColors = ["avatar-sage", "avatar-apricot", "avatar-sky", "avatar-lilac"];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function daysUntil(value: string, today: Date) {
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const due = new Date(`${value}T00:00:00`);
  return Math.round((due.getTime() - startOfToday.getTime()) / 86_400_000);
}

function subscribeToLocalDate(onChange: () => void) {
  const interval = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(interval);
}

function getLocalDateSnapshot() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getServerDateSnapshot() {
  return "2026-10-29";
}

function dueLabel(value: string, today: Date) {
  const days = daysUntil(value, today);
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return formatDate(value);
}

function AvatarStack({ members }: { members: string[] }) {
  return (
    <div className="avatar-stack" aria-label={`${members.length} team members`}>
      {members.slice(0, 3).map((member, index) => (
        <span className={`avatar ${avatarColors[index % avatarColors.length]}`} key={member}>
          {member}
        </span>
      ))}
      {members.length > 3 && <span className="avatar avatar-more">+{members.length - 3}</span>}
    </div>
  );
}

function ProgressBar({ value, color = "green" }: { value: number; color?: string }) {
  return (
    <div
      aria-label={`${value}% complete`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={value}
      className={`progress-track progress-${color}`}
      role="progressbar"
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`status-badge status-${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

function TaskRow({
  task,
  project,
  onToggle,
  today,
}: {
  task: WorkspaceTask;
  project?: WorkspaceProject;
  onToggle: (taskId: string) => void;
  today: Date;
}) {
  return (
    <div className={`task-row${task.complete ? " task-complete" : ""}`}>
      <button
        aria-checked={task.complete}
        aria-label={`${task.complete ? "Mark incomplete" : "Mark complete"}: ${task.title}`}
        className="task-check"
        onClick={() => onToggle(task.id)}
        role="checkbox"
        type="button"
      >
        {task.complete && <Check size={14} strokeWidth={2.5} />}
      </button>
      <div className="task-copy">
        <span className="task-title">{task.title}</span>
        {project && <span className="task-project">{project.name}</span>}
      </div>
      <span className={`priority priority-${task.priority.toLowerCase()}`}>
        <span />
        {task.priority}
      </span>
      <span className={`task-due${daysUntil(task.dueDate, today) < 0 && !task.complete ? " overdue" : ""}`}>
        <CalendarDays size={14} />
        {dueLabel(task.dueDate, today)}
      </span>
      <span className={`avatar task-assignee ${avatarColors[teamMembers.findIndex((member) => member.initials === task.assignee) % avatarColors.length]}`}>
        {task.assignee}
      </span>
    </div>
  );
}

function ProjectCard({
  project,
  tasks,
  onOpen,
}: {
  project: WorkspaceProject;
  tasks: WorkspaceTask[];
  onOpen: () => void;
}) {
  const openCount = tasks.filter((task) => !task.complete).length;

  return (
    <button className={`project-card project-${project.color}`} onClick={onOpen} type="button">
      <span className="project-card-top">
        <span className="project-mark"><FolderKanban size={18} /></span>
        <MoreHorizontal aria-hidden="true" size={19} />
      </span>
      <span className="project-card-client">{project.client}</span>
      <span className="project-card-name">{project.name}</span>
      <StatusBadge status={project.status} />
      <span className="project-card-progress">
        <span>Progress</span>
        <span>{project.progress}%</span>
      </span>
      <ProgressBar value={project.progress} color={project.color} />
      <span className="project-card-bottom">
        <AvatarStack members={project.members} />
        <span className="project-task-count">{openCount} open {openCount === 1 ? "task" : "tasks"}</span>
      </span>
      <span className="sr-only">Open {project.name}</span>
    </button>
  );
}

function ProjectForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (values: ProjectFormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", client: "", dueDate: "" },
  });

  return (
    <form className="dialog-form" noValidate onSubmit={handleSubmit(onCreate)}>
      <DialogHeader>
        <DialogTitle className="dialog-title">Create a project</DialogTitle>
        <DialogDescription className="dialog-description">
          Add a new project to this demo workspace.
        </DialogDescription>
      </DialogHeader>
      <label className="field-label" htmlFor="project-name">Project name</label>
      <Input aria-describedby={errors.name ? "project-name-error" : undefined} aria-invalid={Boolean(errors.name)} autoFocus id="project-name" placeholder="e.g. Spring campaign" {...register("name")} />
      {errors.name && <span className="field-error" id="project-name-error">{errors.name.message}</span>}
      <label className="field-label" htmlFor="project-client">Client or team</label>
      <Input aria-describedby={errors.client ? "project-client-error" : undefined} aria-invalid={Boolean(errors.client)} id="project-client" placeholder="e.g. Acme Studio" {...register("client")} />
      {errors.client && <span className="field-error" id="project-client-error">{errors.client.message}</span>}
      <label className="field-label" htmlFor="project-date">Target date</label>
      <Input aria-describedby={errors.dueDate ? "project-date-error" : undefined} aria-invalid={Boolean(errors.dueDate)} id="project-date" type="date" {...register("dueDate")} />
      {errors.dueDate && <span className="field-error" id="project-date-error">{errors.dueDate.message}</span>}
      <DialogFooter className="dialog-actions">
        <Button className="cancel-button" onClick={onClose} type="button" variant="outline">Cancel</Button>
        <Button className="submit-button" disabled={isSubmitting} type="submit"><Plus size={16} /> Create project</Button>
      </DialogFooter>
    </form>
  );
}

function TaskForm({
  projects,
  onClose,
  onCreate,
}: {
  projects: WorkspaceProject[];
  onClose: () => void;
  onCreate: (values: TaskFormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      projectId: projects[0]?.id ?? "",
      dueDate: "",
      priority: "Medium",
      assignee: teamMembers[0].initials,
    },
  });

  return (
    <form className="dialog-form" noValidate onSubmit={handleSubmit(onCreate)}>
      <DialogHeader>
        <DialogTitle className="dialog-title">Add a task</DialogTitle>
        <DialogDescription className="dialog-description">
          Give the next step an owner and a date.
        </DialogDescription>
      </DialogHeader>
      <label className="field-label" htmlFor="task-title">Task name</label>
      <Input aria-describedby={errors.title ? "task-title-error" : undefined} aria-invalid={Boolean(errors.title)} autoFocus id="task-title" placeholder="What needs to get done?" {...register("title")} />
      {errors.title && <span className="field-error" id="task-title-error">{errors.title.message}</span>}
      <div className="field-grid">
        <div>
          <label className="field-label" htmlFor="task-project">Project</label>
          <select aria-invalid={Boolean(errors.projectId)} className="form-select" id="task-project" {...register("projectId")}>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          {errors.projectId && <span className="field-error">{errors.projectId.message}</span>}
        </div>
        <div>
          <label className="field-label" htmlFor="task-assignee">Assignee</label>
          <select aria-invalid={Boolean(errors.assignee)} className="form-select" id="task-assignee" {...register("assignee")}>
            {teamMembers.map((member) => <option key={member.initials} value={member.initials}>{member.name}</option>)}
          </select>
          {errors.assignee && <span className="field-error">{errors.assignee.message}</span>}
        </div>
      </div>
      <div className="field-grid">
        <div>
          <label className="field-label" htmlFor="task-date">Due date</label>
          <Input aria-describedby={errors.dueDate ? "task-date-error" : undefined} aria-invalid={Boolean(errors.dueDate)} id="task-date" type="date" {...register("dueDate")} />
          {errors.dueDate && <span className="field-error" id="task-date-error">{errors.dueDate.message}</span>}
        </div>
        <div>
          <label className="field-label" htmlFor="task-priority">Priority</label>
          <select className="form-select" id="task-priority" {...register("priority")}>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>
      <DialogFooter className="dialog-actions">
        <Button className="cancel-button" onClick={onClose} type="button" variant="outline">Cancel</Button>
        <Button className="submit-button" disabled={isSubmitting || projects.length === 0} type="submit"><Plus size={16} /> Add task</Button>
      </DialogFooter>
    </form>
  );
}

export function Workspace() {
  const searchRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const localDate = useSyncExternalStore(subscribeToLocalDate, getLocalDateSnapshot, getServerDateSnapshot);
  const today = new Date(`${localDate}T00:00:00`);
  const [view, setView] = useState<View>("overview");
  const [dialog, setDialog] = useState<DialogView>(null);
  const [projects, setProjects] = useState(initialProjects);
  const [tasks, setTasks] = useState(initialTasks);
  const [query, setQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState("open");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setMobileNavOpen(false);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleProjects = projects.filter((project) => {
    const matchesSearch = `${project.name} ${project.client}`.toLowerCase().includes(normalizedQuery);
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const visibleTasks = tasks.filter((task) => {
    const project = projectById(projects, task.projectId);
    const matchesSearch = `${task.title} ${project?.name ?? ""}`.toLowerCase().includes(normalizedQuery);
    const matchesProject = !selectedProject || task.projectId === selectedProject;
    const matchesFilter = taskFilter === "all"
      || (taskFilter === "open" && !task.complete)
      || (taskFilter === "complete" && task.complete)
      || (taskFilter === "mine" && task.assignee === "MC" && !task.complete);
    return matchesSearch && matchesProject && matchesFilter;
  });
  const openTasks = tasks.filter((task) => !task.complete);
  const matchingOpenTasks = openTasks.filter((task) => {
    const project = projectById(projects, task.projectId);
    return `${task.title} ${project?.name ?? ""}`.toLowerCase().includes(normalizedQuery);
  });
  const dueSoon = openTasks.filter((task) => {
    const days = daysUntil(task.dueDate, today);
    return days >= 0 && days <= 7;
  });
  const activeProjects = projects.filter((project) => project.status !== "Planning");
  const currentProject = selectedProject ? projectById(projects, selectedProject) : undefined;

  function navigate(nextView: View) {
    setView(nextView);
    setSelectedProject(null);
    setQuery("");
    setMobileNavOpen(false);
  }

  function toggleTask(taskId: string) {
    setTasks((currentTasks) => currentTasks.map((task) =>
      task.id === taskId ? { ...task, complete: !task.complete } : task,
    ));
  }

  const createProject: SubmitHandler<ProjectFormValues> = (values) => {
    const id = `${Date.now()}`;
    const colors: WorkspaceProject["color"][] = ["green", "orange", "blue", "yellow"];
    const newProject: WorkspaceProject = {
      id,
      name: values.name,
      client: values.client,
      status: "Planning",
      progress: 0,
      dueDate: values.dueDate,
      members: ["MC"],
      color: colors[projects.length % colors.length],
    };
    setProjects((currentProjects) => [newProject, ...currentProjects]);
    setDialog(null);
    setView("projects");
    toast.success("Project created", { description: "Saved in this demo session only." });
  };

  const createTask: SubmitHandler<TaskFormValues> = (values) => {
    const newTask: WorkspaceTask = {
      ...values,
      id: `${Date.now()}`,
      complete: false,
    };
    setTasks((currentTasks) => [newTask, ...currentTasks]);
    setDialog(null);
    setTaskFilter("open");
    setView("tasks");
    toast.success("Task added", { description: "Saved in this demo session only." });
  };

  function openProject(project: WorkspaceProject) {
    setSelectedProject(project.id);
    setTaskFilter("all");
    setView("tasks");
  }

  const pageTitle = view === "overview" ? "Your workspace" : view === "projects" ? "Projects" : currentProject?.name ?? "My tasks";

  return (
    <div className="app-shell">
      <aside className={`sidebar${mobileNavOpen ? " sidebar-open" : ""}`}>
        <div className="brand-row">
          <span className="brand-mark"><Compass size={19} strokeWidth={2.2} /></span>
          <span className="brand-name">waypoint</span>
          <button aria-label="Close navigation" className="icon-button mobile-close" onClick={() => setMobileNavOpen(false)} type="button"><X size={18} /></button>
        </div>
        <button className="workspace-switcher" onClick={() => toast("You're viewing the Waypoint Studio demo workspace.")} type="button">
          <span className="workspace-avatar">W</span>
          <span className="workspace-name"><strong>Waypoint Studio</strong><small>Free workspace</small></span>
          <ChevronDown size={16} />
        </button>
        <div className="sidebar-label">Workspace</div>
        <nav aria-label="Main navigation" className="main-nav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              aria-current={view === id ? "page" : undefined}
              className={`nav-link${view === id ? " nav-link-active" : ""}`}
              key={id}
              onClick={() => navigate(id)}
              type="button"
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === "tasks" && <span className="nav-count">{openTasks.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-label projects-label"><span>Recent projects</span><button aria-label="Create project" className="sidebar-add" onClick={() => setDialog("project")} type="button"><Plus size={15} /></button></div>
        <div className="recent-projects">
          {projects.slice(0, 4).map((project) => (
            <button className="recent-project" key={project.id} onClick={() => openProject(project)} type="button">
              <span className={`project-dot dot-${project.color}`} />
              <span>{project.name}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <button className="sidebar-help" onClick={() => setHelpOpen(true)} type="button"><CircleHelp size={17} /> Help & feedback</button>
          <button className="profile-row" onClick={() => toast("Signed in as Maya Chen in this demo workspace.")} type="button">
            <span className="avatar avatar-sage profile-avatar">MC</span>
            <span className="profile-copy"><strong>Maya Chen</strong><small>Studio owner</small></span>
            <MoreHorizontal size={17} />
          </button>
        </div>
      </aside>

      {mobileNavOpen && <button aria-label="Close navigation" className="nav-scrim" onClick={() => setMobileNavOpen(false)} type="button" />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button aria-label="Open navigation" className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} type="button"><Menu size={19} /></button>
            <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{pageTitle}</strong></div>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input aria-label="Search projects and tasks" onChange={(event) => setQuery(event.target.value)} placeholder="Search anything..." ref={searchRef} value={query} />
              <kbd><Command size={11} /> K</kbd>
            </label>
            <div className="notification-wrap">
              <Button aria-expanded={notificationsOpen} aria-label="Notifications" className="icon-button notification-button" onClick={() => setNotificationsOpen((open) => !open)} size="icon" variant="outline"><Bell size={17} /></Button>
              <span className="notification-dot" />
              {notificationsOpen && (
                <div className="notification-popover">
                  <div className="popover-heading"><strong>Notifications</strong><span>Recent</span></div>
                  <div className="notification-item"><span className="notification-icon"><CheckCheck size={15} /></span><span><strong>Goodwell packaging</strong><small>Production handoff was completed.</small><small>Yesterday</small></span></div>
                  <div className="notification-item"><span className="notification-icon warm"><CalendarDays size={15} /></span><span><strong>Fieldnotes launch</strong><small>Homepage review is due tomorrow.</small><small>Today</small></span></div>
                </div>
              )}
            </div>
            <Button className="new-project-button" onClick={() => setDialog("project")}><Plus size={16} /> New project</Button>
          </div>
        </header>

        <div className="page-content">
          <div className="demo-notice"><Sparkles size={14} /><span>Demo workspace</span><span className="notice-divider" /><span>Changes stay in this browser session</span></div>

          <AnimatePresence mode="wait">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="page-transition"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
              key={view + (selectedProject ?? "")}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
            >
              {view === "overview" && (
                <>
                  <section className="page-heading">
                    <div><p className="eyebrow">{new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(today)}</p><h1>Your week, at a glance.</h1><p className="page-subtitle">A clear view of what is moving and what needs you next.</p></div>
                    <Button className="quick-task-button" onClick={() => setDialog("task")} variant="outline"><Plus size={16} /> Add a task</Button>
                  </section>

                  <section aria-label="Workspace summary" className="stat-grid">
                    <article className="stat-card"><span className="stat-label">Active projects</span><span className="stat-value">{activeProjects.length}<span className="stat-context"> of {projects.length}</span></span><span className="stat-foot"><span className="stat-foot-icon"><FolderKanban size={14} /></span>Across your workspace</span></article>
                    <article className="stat-card"><span className="stat-label">Open tasks</span><span className="stat-value">{openTasks.length}<span className="stat-context"> tasks</span></span><span className="stat-foot positive"><ArrowDownRight size={14} /> {tasks.filter((task) => task.complete).length} completed so far</span></article>
                    <article className="stat-card stat-card-accent"><span className="stat-label">Due this week</span><span className="stat-value">{dueSoon.length}<span className="stat-context"> tasks</span></span><span className="stat-foot"><CalendarDays size={14} /> Next 7 days</span></article>
                    <article className="stat-card"><span className="stat-label">Needs attention</span><span className="stat-value">{projects.filter((project) => project.status === "At risk").length}<span className="stat-context"> project</span></span><span className="stat-foot attention"><ArrowUpRight size={14} /> Check in with your team</span></article>
                  </section>

                  <section className="overview-grid">
                    <div className="content-panel projects-panel">
                      <div className="section-heading"><div><h2>Projects in motion</h2><p>The work your team is moving forward.</p></div><button className="text-action" onClick={() => navigate("projects")} type="button">All projects <ChevronRight size={15} /></button></div>
                      <div className="project-grid">
                        {visibleProjects.length > 0 ? visibleProjects.slice(0, 3).map((project) => <ProjectCard key={project.id} onOpen={() => openProject(project)} project={project} tasks={tasks.filter((task) => task.projectId === project.id)} />) : <p className="empty-inline">No projects match that search.</p>}
                      </div>
                    </div>
                    <div className="content-panel attention-panel">
                      <div className="section-heading"><div><h2>Coming up</h2><p>Your next few days, sorted.</p></div><button aria-label="View all tasks" className="icon-link" onClick={() => navigate("tasks")} type="button"><ChevronRight size={17} /></button></div>
                      <div className="upcoming-list">
                        {[...matchingOpenTasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4).map((task) => {
                          const project = projectById(projects, task.projectId);
                          return <button className="upcoming-item" key={task.id} onClick={() => { setSelectedProject(task.projectId); setTaskFilter("all"); setView("tasks"); }} type="button"><span className={`upcoming-date ${daysUntil(task.dueDate, today) < 0 ? "upcoming-overdue" : ""}`}><strong>{new Intl.DateTimeFormat("en", { day: "2-digit" }).format(new Date(`${task.dueDate}T12:00:00`))}</strong><small>{new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(`${task.dueDate}T12:00:00`))}</small></span><span className="upcoming-copy"><strong>{task.title}</strong><small>{project?.name ?? "Unknown project"}</small></span><ChevronRight size={15} /></button>;
                        })}
                        {matchingOpenTasks.length === 0 && <p className="empty-inline">{normalizedQuery ? "No upcoming tasks match that search." : "Nothing due right now. Nice work."}</p>}
                      </div>
                    </div>
                  </section>

                  <section className="content-panel task-panel">
                    <div className="section-heading"><div><h2>Tasks to keep moving</h2><p>Small next steps, all in one place.</p></div><div className="section-actions"><button className="text-action" onClick={() => navigate("tasks")} type="button">View all <ChevronRight size={15} /></button><Button className="compact-add" onClick={() => setDialog("task")} size="sm" variant="outline"><Plus size={14} /> Add task</Button></div></div>
                    <div className="task-table-head"><span>Task</span><span>Priority</span><span>Due date</span><span>Owner</span></div>
                    <div className="task-list">
                      {matchingOpenTasks.slice(0, 4).map((task) => <TaskRow key={task.id} onToggle={toggleTask} project={projectById(projects, task.projectId)} task={task} today={today} />)}
                      {matchingOpenTasks.length === 0 && <EmptyState title={normalizedQuery ? "No tasks match that search" : "You're all caught up"} detail={normalizedQuery ? "Try a different search term." : "Add a task when there is something new to tackle."} />}
                    </div>
                  </section>
                </>
              )}

              {view === "projects" && (
                <>
                  <section className="page-heading page-heading-compact">
                    <div><p className="eyebrow">THE WORKSPACE</p><h1>Projects</h1><p className="page-subtitle">Keep the moving pieces in view.</p></div>
                    <Button className="new-project-button heading-action" onClick={() => setDialog("project")}><Plus size={16} /> New project</Button>
                  </section>
                  <div className="filter-bar"><div className="filter-count">{visibleProjects.length} {visibleProjects.length === 1 ? "project" : "projects"}</div><label className="filter-select-label"><span>Status</span><select aria-label="Filter projects by status" className="filter-select" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option value="all">All statuses</option><option value="In progress">In progress</option><option value="Planning">Planning</option><option value="At risk">At risk</option></select><ChevronDown size={14} /></label></div>
                  {visibleProjects.length > 0 ? <div className="all-projects-grid">{visibleProjects.map((project) => <ProjectCard key={project.id} onOpen={() => openProject(project)} project={project} tasks={tasks.filter((task) => task.projectId === project.id)} />)}</div> : <EmptyState title="No projects match that search" detail="Try another project name or status." />}
                </>
              )}

              {view === "tasks" && (
                <>
                  <section className="page-heading page-heading-compact">
                    <div><p className="eyebrow">YOUR TEAM&apos;S NEXT STEPS</p><h1>{currentProject?.name ?? "My tasks"}</h1><p className="page-subtitle">{currentProject ? `${currentProject.client} · ${tasks.filter((task) => task.projectId === currentProject.id).length} tasks` : "A practical list of what needs to happen next."}</p></div>
                    <Button className="new-project-button heading-action" onClick={() => setDialog("task")}><Plus size={16} /> Add task</Button>
                  </section>
                  {currentProject && <button className="back-link" onClick={() => { setSelectedProject(null); setView("projects"); }} type="button"><ChevronRight size={14} /> Back to projects</button>}
                  <section className="content-panel full-task-panel">
                    <div className="task-toolbar"><div className="task-filters" role="group" aria-label="Filter tasks"><button aria-pressed={taskFilter === "open"} className={taskFilter === "open" ? "filter-tab active" : "filter-tab"} onClick={() => setTaskFilter("open")} type="button">Open <span>{openTasks.length}</span></button><button aria-pressed={taskFilter === "mine"} className={taskFilter === "mine" ? "filter-tab active" : "filter-tab"} onClick={() => setTaskFilter("mine")} type="button">Assigned to me</button><button aria-pressed={taskFilter === "complete"} className={taskFilter === "complete" ? "filter-tab active" : "filter-tab"} onClick={() => setTaskFilter("complete")} type="button">Completed</button><button aria-pressed={taskFilter === "all"} className={taskFilter === "all" ? "filter-tab active" : "filter-tab"} onClick={() => setTaskFilter("all")} type="button">All tasks</button></div><span className="task-result-count">{visibleTasks.length} results</span></div>
                    <div className="task-table-head"><span>Task</span><span>Priority</span><span>Due date</span><span>Owner</span></div>
                    <div className="task-list">
                      {visibleTasks.map((task) => <TaskRow key={task.id} onToggle={toggleTask} project={currentProject ? undefined : projectById(projects, task.projectId)} task={task} today={today} />)}
                      {visibleTasks.length === 0 && <EmptyState title={normalizedQuery ? "No tasks match that search" : "No tasks here"} detail={normalizedQuery ? "Try a different search term." : "There is nothing in this view right now."} />}
                    </div>
                  </section>
                </>
              )}

              {view === "overview" && (
                <section className="momentum-strip"><div className="momentum-icon"><Sparkles size={17} /></div><div><strong>Good work moves in small steps.</strong><p>Your team has {tasks.filter((task) => task.complete).length} completed {tasks.filter((task) => task.complete).length === 1 ? "task" : "tasks"} in this demo workspace. Keep the momentum going.</p></div><button aria-label="View my tasks" onClick={() => navigate("tasks")} type="button"><ChevronRight size={17} /></button></section>
              )}
            </motion.div>
          </AnimatePresence>
          <footer className="page-footer"><span>Waypoint Studio</span><span>Made for teams that do good work.</span></footer>
        </div>
      </main>

      <Dialog onOpenChange={(open) => !open && setDialog(null)} open={dialog === "project"}>
        <DialogContent className="workspace-dialog" showCloseButton>
          <ProjectForm onClose={() => setDialog(null)} onCreate={createProject} />
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={(open) => !open && setDialog(null)} open={dialog === "task"}>
        <DialogContent className="workspace-dialog" showCloseButton>
          <TaskForm onClose={() => setDialog(null)} onCreate={createTask} projects={projects} />
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={setHelpOpen} open={helpOpen}>
        <DialogContent className="workspace-dialog help-dialog">
          <DialogHeader><DialogTitle className="dialog-title">Waypoint help</DialogTitle><DialogDescription className="dialog-description">This is a local demo workspace. Projects and tasks you add or complete are held in page state and reset when the page reloads.</DialogDescription></DialogHeader>
          <div className="help-contact"><CircleHelp size={18} /><span><strong>Need product support?</strong><small>Connect a support address when your workspace backend is ready.</small></span></div>
          <DialogFooter className="dialog-actions"><Button className="submit-button" onClick={() => setHelpOpen(false)}>Got it</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span className="empty-icon"><CheckCheck size={19} /></span><strong>{title}</strong><p>{detail}</p></div>;
}

