export type ProjectStatus = "In progress" | "Planning" | "At risk";
export type TaskPriority = "High" | "Medium" | "Low";

export type WorkspaceProject = {
  id: string;
  name: string;
  client: string;
  status: ProjectStatus;
  progress: number;
  dueDate: string;
  members: string[];
  color: "green" | "orange" | "blue" | "yellow";
};

export type WorkspaceTask = {
  id: string;
  title: string;
  projectId: string;
  dueDate: string;
  priority: TaskPriority;
  assignee: string;
  complete: boolean;
};

export const initialProjects: WorkspaceProject[] = [
  {
    id: "northstar",
    name: "Northstar rebrand",
    client: "Northstar Studio",
    status: "In progress",
    progress: 68,
    dueDate: "2026-11-06",
    members: ["MC", "JL", "AR"],
    color: "green",
  },
  {
    id: "fieldnotes",
    name: "Fieldnotes launch",
    client: "Fieldnotes Co.",
    status: "At risk",
    progress: 42,
    dueDate: "2026-11-02",
    members: ["SK", "MC"],
    color: "orange",
  },
  {
    id: "goodwell",
    name: "Goodwell packaging",
    client: "Goodwell Foods",
    status: "In progress",
    progress: 84,
    dueDate: "2026-11-12",
    members: ["AR", "JL", "SK"],
    color: "blue",
  },
  {
    id: "common-ground",
    name: "Common Ground site",
    client: "Common Ground",
    status: "Planning",
    progress: 12,
    dueDate: "2026-11-20",
    members: ["JL", "MC"],
    color: "yellow",
  },
];

export const initialTasks: WorkspaceTask[] = [
  {
    id: "task-1",
    title: "Share first-round logo concepts",
    projectId: "northstar",
    dueDate: "2026-10-29",
    priority: "High",
    assignee: "MC",
    complete: false,
  },
  {
    id: "task-2",
    title: "Review homepage wireframes",
    projectId: "fieldnotes",
    dueDate: "2026-10-30",
    priority: "High",
    assignee: "SK",
    complete: false,
  },
  {
    id: "task-3",
    title: "Approve final label copy",
    projectId: "goodwell",
    dueDate: "2026-10-31",
    priority: "Medium",
    assignee: "AR",
    complete: false,
  },
  {
    id: "task-4",
    title: "Collect stakeholder feedback",
    projectId: "northstar",
    dueDate: "2026-11-02",
    priority: "Medium",
    assignee: "JL",
    complete: false,
  },
  {
    id: "task-5",
    title: "Prepare production handoff",
    projectId: "goodwell",
    dueDate: "2026-11-04",
    priority: "Low",
    assignee: "AR",
    complete: true,
  },
  {
    id: "task-6",
    title: "Set kickoff agenda",
    projectId: "common-ground",
    dueDate: "2026-11-05",
    priority: "Low",
    assignee: "JL",
    complete: false,
  },
];

export const teamMembers = [
  { initials: "MC", name: "Maya Chen" },
  { initials: "JL", name: "Jordan Lee" },
  { initials: "AR", name: "Alex Rivera" },
  { initials: "SK", name: "Sam Kim" },
];

export const projectById = (projects: WorkspaceProject[], id: string) =>
  projects.find((project) => project.id === id);