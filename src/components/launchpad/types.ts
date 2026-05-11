export type RepoInfo = {
  path: string;
  name: string;
  branch: string | null;
  loading: boolean;
  error: string | null;
};

export type SectionProps = {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};
