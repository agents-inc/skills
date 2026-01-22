import pc from 'picocolors';

let verboseMode = false;

export function setVerbose(enabled: boolean): void {
  verboseMode = enabled;
}

export function verbose(msg: string): void {
  if (verboseMode) {
    console.log(pc.dim(`  ${msg}`));
  }
}
