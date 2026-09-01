import { glossary, type GlossaryKey } from "@/shared/content/glossary";
import { HelpTooltip } from "./HelpTooltip";

export function TermHelp({ term }: { term: GlossaryKey }) {
  return <HelpTooltip label={`${term} 용어 도움말`} content={glossary[term]} />;
}
