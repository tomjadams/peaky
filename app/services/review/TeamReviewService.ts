import { reviewMutations } from "~/services/entity/ReviewMutations";
import { teamMutations } from "~/services/entity/TeamMutations";
import { cachePublishedTemplateRevisions } from "~/services/template/TemplateRevisionSnapshotCache";

export interface TeamProfileInput {
  id: string;
  slug: string;
  name: string;
  orgId: string;
  orgName: string;
  memberCount: number;
}

export interface CreateTeamReviewInput {
  team: TeamProfileInput;
  name: string;
  templateRevisionIds: string[];
  scope: "team" | "application";
  applicationIds: string[];
}

export class TeamReviewService {
  async ensureTeamProfile(team: TeamProfileInput): Promise<void> {
    await teamMutations.upsert(team);
  }

  async create(input: CreateTeamReviewInput): Promise<string> {
    await cachePublishedTemplateRevisions(input.templateRevisionIds);
    await this.ensureTeamProfile(input.team);

    return reviewMutations.create({
      subjectId: input.team.id,
      subjectType: "team",
      name: input.name,
      templateRevisionIds: input.templateRevisionIds,
      scope: input.scope,
      applicationIds: input.applicationIds,
      teamIds: [input.team.id],
    });
  }
}

export const teamReviewService = new TeamReviewService();
