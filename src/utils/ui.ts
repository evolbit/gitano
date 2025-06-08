// Utility function to mix multiple css classes
export function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}
