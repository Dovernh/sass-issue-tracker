import { type IssueCategory, type IssuePriority } from "../../api/proxies/issueTrackerAPI.schemas";

export interface CreateEditIssueData {
  description: string;
  priority: IssuePriority;
  category: IssueCategory;
  assignedUser: string;
}
