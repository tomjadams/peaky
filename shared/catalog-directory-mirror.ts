export interface DirectoryUser {
  id: string;
  displayName: string;
}

export interface DirectoryGroup {
  id: string;
  displayName: string;
  description?: string;
  orgId?: string;
  orgName?: string;
  memberCount?: number;
}

export interface CatalogComponent {
  id: string;
  displayName: string;
  description?: string;
  type?: string;
  ownerGroupId?: string;
  ownerGroupName?: string;
  lifecycle?: string;
  system?: string;
}

export interface CatalogDirectoryMirrorSnapshot {
  version: string;
  generatedAt: string;
  users: DirectoryUser[];
  groups: DirectoryGroup[];
  components: CatalogComponent[];
}
