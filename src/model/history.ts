/**
 * Undo and redo. Holds the current document and, for each step, the command that made it and
 * the command that reverses it. A drag or a slider runs inside begin() and commit(), so the
 * whole gesture is one step.
 */
import { applyCommand, type Command } from './commands.ts';
import { ModelError, type Doc } from './document.ts';

interface Step {
  readonly forward: Command;
  readonly inverse: Command;
}

interface Group {
  /** The document before the gesture started, restored by cancel(). */
  readonly start: Doc;
  readonly forward: Command[];
  readonly inverse: Command[];
}

export class History {
  #doc: Doc;
  #undo: Step[] = [];
  #redo: Step[] = [];
  #group: Group | null = null;
  #listeners = new Set<() => void>();
  /** How many steps undo can go back. */
  readonly limit: number;

  constructor(doc: Doc, limit = 150) {
    this.#doc = doc;
    this.limit = limit;
  }

  get doc(): Doc {
    return this.#doc;
  }
  get canUndo(): boolean {
    return this.#undo.length > 0 || this.#group !== null;
  }
  get canRedo(): boolean {
    return this.#redo.length > 0 && this.#group === null;
  }
  get inGroup(): boolean {
    return this.#group !== null;
  }

  /** Calls `listener` after every change to the document; returns an unsubscribe function. */
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  getDoc = (): Doc => this.#doc;

  /**
   * Applies a command as one undo step, or as part of the open group. Throws a ModelError
   * and changes nothing when the command is invalid. Returns the new document.
   */
  execute(cmd: Command): Doc {
    const r = applyCommand(this.#doc, cmd);
    if (!r.changed) return this.#doc;
    if (this.#group) {
      this.#addToGroup(this.#group, cmd, r.inverse);
    } else {
      this.#push({ forward: cmd, inverse: r.inverse });
    }
    this.#set(r.doc);
    return r.doc;
  }

  /** Starts a gesture: commands until commit() become a single undo step. */
  begin(): void {
    if (this.#group) throw new ModelError('An edit is already in progress');
    this.#group = { start: this.#doc, forward: [], inverse: [] };
  }

  /** Ends the gesture, recording it as one step if it changed anything. */
  commit(): void {
    const g = this.#group;
    if (!g) return;
    this.#group = null;
    if (g.forward.length) {
      this.#push({
        forward: { type: 'batch', commands: g.forward },
        inverse: { type: 'batch', commands: [...g.inverse].reverse() },
      });
    }
  }

  /** Ends the gesture and puts the document back as it was when it began. */
  cancel(): void {
    const g = this.#group;
    if (!g) return;
    this.#group = null;
    this.#set(g.start);
  }

  /** Steps back once. During a gesture, cancels it. Returns false when there is nothing to undo. */
  undo(): boolean {
    if (this.#group) {
      this.cancel();
      return true;
    }
    const step = this.#undo.pop();
    if (!step) return false;
    this.#set(applyCommand(this.#doc, step.inverse).doc);
    this.#redo.push(step);
    return true;
  }

  /** Repeats the last undone step. Returns false when there is nothing to redo. */
  redo(): boolean {
    if (this.#group) return false;
    const step = this.#redo.pop();
    if (!step) return false;
    this.#set(applyCommand(this.#doc, step.forward).doc);
    this.#undo.push(step);
    return true;
  }

  /** Replaces the document, for example after opening a file, and clears the history. */
  reset(doc: Doc): void {
    this.#group = null;
    this.#undo = [];
    this.#redo = [];
    this.#set(doc);
  }

  #push(step: Step) {
    this.#undo.push(step);
    if (this.#undo.length > this.limit) this.#undo.shift();
    this.#redo = [];
  }

  /** Consecutive property edits on one instance merge, so a long drag stays one small step. */
  #addToGroup(g: Group, cmd: Command, inverse: Command) {
    const last = g.forward[g.forward.length - 1];
    const lastInverse = g.inverse[g.inverse.length - 1];
    if (
      cmd.type === 'setProps' &&
      last?.type === 'setProps' &&
      lastInverse?.type === 'setProps' &&
      inverse.type === 'setProps' &&
      last.id === cmd.id
    ) {
      g.forward[g.forward.length - 1] = {
        ...last,
        props: { ...last.props, ...cmd.props },
        preview: cmd.preview !== undefined ? cmd.preview : last.preview,
      };
      // The earliest old value of each property is the one to restore.
      g.inverse[g.inverse.length - 1] = {
        ...lastInverse,
        props: { ...inverse.props, ...lastInverse.props },
        preview: lastInverse.preview !== undefined ? lastInverse.preview : inverse.preview,
      };
      return;
    }
    g.forward.push(cmd);
    g.inverse.push(inverse);
  }

  #set(doc: Doc) {
    this.#doc = doc;
    this.#listeners.forEach((l) => l());
  }
}
