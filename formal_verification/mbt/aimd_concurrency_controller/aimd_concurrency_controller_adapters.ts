/**
 * Model-based test adapter: drives the real ConcurrencyController through the
 * state space of resilience/aimd_concurrency_controller.fizz.
 *
 * This is the one mechanism that connects a spec to the code — `make verify`
 * only checks the model against itself. The runner replays every action
 * sequence the checker found and compares the object's batch size against the
 * spec's batch_size after each step, so an implementation that stops matching
 * the model fails here.
 *
 * Deliberately no assertions in the actions: the oracle is the spec's
 * `always assertion` blocks plus the getState() comparison below.
 *
 * Run with `make verify-mbt`. Generated siblings (*_interfaces.ts, *_test.ts)
 * are regenerated from the spec — see section 9 of
 * site/docs/development/walkthroughs/formal-verification.md.
 */
import type { Arg } from "@fizzbee/mbt";

import { ConcurrencyController } from "../../../app/services/sync/ConcurrencyController";

import type {
  AimdConcurrencyControllerModel,
  ControllerRole,
} from "./aimd_concurrency_controller_interfaces.js";

class ControllerRoleAdapter implements ControllerRole {
  private sut = new ConcurrencyController();

  async actionOnSuccess(_args: Arg[]): Promise<void> {
    this.sut.onSuccess();
  }

  async actionOnFailure(_args: Arg[]): Promise<void> {
    this.sut.onFailure();
  }

  /** Field names must match the role's state variables in the spec. */
  async getState(): Promise<Record<string, unknown>> {
    return { batch_size: this.sut.batchSize };
  }
}

export class AimdConcurrencyControllerModelAdapter implements AimdConcurrencyControllerModel {
  private controller?: ControllerRoleAdapter;

  async init(): Promise<void> {
    this.controller = new ControllerRoleAdapter();
  }

  async getRoles(): Promise<Map<string, unknown>> {
    return new Map([["Controller#0", this.controller]]);
  }

  async cleanup(): Promise<void> {}

  async cleanupAll(): Promise<void> {}
}

export function newAimdConcurrencyControllerModel(): AimdConcurrencyControllerModel {
  return new AimdConcurrencyControllerModelAdapter();
}

export function getTestOptions(): Record<string, unknown> {
  return {
    "max-seq-runs": 200,
    // The controller is a plain object with no shared state between runs, so
    // parallel runs would add time without adding coverage.
    "max-parallel-runs": 0,
    "max-actions": 10,
  };
}
