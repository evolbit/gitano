import Launchpad from "../launchpad/Launchpad";

export const HomePage = ({
  onRepoOpened,
}: {
  onRepoOpened?: (path: string) => void;
}) => {
  return <Launchpad onRepoOpened={onRepoOpened} />;
};

export default HomePage;
