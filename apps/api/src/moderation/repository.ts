export type ModerationFlag = {
  id: string;
  marketId: string;
  companyId?: string;
  userId?: string;
  contentType: "MESSAGE" | "LISTING" | "STORE" | "IMAGE";
  contentId: string;
  decision: "ALLOW" | "MASK" | "BLOCK";
  reasons: string[];
  source: "SYNC" | "ASYNC_TEXT" | "ASYNC_OCR" | "REPORT" | "REVIEW";
  status: "OPEN" | "APPROVED" | "REJECTED" | "RESOLVED";
  redactedExcerpt?: string;
  createdAt: string;
};
export type ModerationPolicy = {
  warningThreshold: number;
  suspendThreshold: number;
  blockThreshold: number;
  suspensionHours: number;
};
export type ModerationSanction = {
  id: string;
  kind: "WARNING" | "SUSPENSION" | "BLOCK";
  reason: string;
  companyId?: string;
  userId?: string;
  startsAt: string;
  endsAt?: string;
};

export interface ModerationRepository {
  listFlags(input: {
    marketId: string;
    status?: ModerationFlag["status"];
  }): Promise<ModerationFlag[]>;
  reviewFlag(input: {
    marketId: string;
    flagId: string;
    reviewerUserId: string;
    outcome: "CONFIRMED" | "DISMISSED";
    note: string;
  }): Promise<{ flag: ModerationFlag; sanction?: ModerationSanction }>;
  getPolicy(marketId: string): Promise<ModerationPolicy>;
  updatePolicy(
    input: ModerationPolicy & { marketId: string; actorUserId: string },
  ): Promise<ModerationPolicy>;
  history(input: {
    marketId: string;
    companyId?: string;
    userId?: string;
  }): Promise<{
    flags: ModerationFlag[];
    sanctions: ModerationSanction[];
  }>;
}

const defaultPolicy: ModerationPolicy = {
  warningThreshold: 1,
  suspendThreshold: 3,
  blockThreshold: 5,
  suspensionHours: 72,
};

export class InMemoryModerationRepository implements ModerationRepository {
  private readonly flags: ModerationFlag[];
  private readonly sanctions: ModerationSanction[] = [];
  private readonly policies = new Map<string, ModerationPolicy>();
  private confirmedCount: number;
  constructor(
    seed: { flags?: ModerationFlag[]; confirmedCount?: number } = {},
  ) {
    this.flags = seed.flags ?? [];
    this.confirmedCount = seed.confirmedCount ?? 0;
  }
  async listFlags(input: {
    marketId: string;
    status?: ModerationFlag["status"];
  }) {
    return this.flags.filter(
      (flag) =>
        flag.marketId === input.marketId &&
        (!input.status || flag.status === input.status),
    );
  }
  async reviewFlag(input: {
    marketId: string;
    flagId: string;
    outcome: "CONFIRMED" | "DISMISSED";
    note: string;
  }) {
    const flag = this.flags.find(
      (candidate) =>
        candidate.id === input.flagId && candidate.marketId === input.marketId,
    );
    if (!flag) throw new Error("MODERATION_FLAG_NOT_FOUND");
    if (flag.status !== "OPEN")
      throw new Error("MODERATION_FLAG_ALREADY_REVIEWED");
    flag.status = input.outcome === "CONFIRMED" ? "RESOLVED" : "REJECTED";
    if (input.outcome === "DISMISSED") return { flag };
    this.confirmedCount += 1;
    const policy = await this.getPolicy(input.marketId);
    const kind = sanctionKind(this.confirmedCount, policy);
    if (!kind) return { flag };
    const startsAt = new Date();
    const sanction: ModerationSanction = {
      id: crypto.randomUUID(),
      kind,
      reason: input.note,
      startsAt: startsAt.toISOString(),
      ...(flag.companyId ? { companyId: flag.companyId } : {}),
      ...(flag.userId ? { userId: flag.userId } : {}),
      ...(kind === "SUSPENSION"
        ? {
            endsAt: new Date(
              startsAt.getTime() + policy.suspensionHours * 3_600_000,
            ).toISOString(),
          }
        : {}),
    };
    this.sanctions.push(sanction);
    return { flag, sanction };
  }
  async getPolicy(marketId: string) {
    return this.policies.get(marketId) ?? { ...defaultPolicy };
  }
  async updatePolicy(input: ModerationPolicy & { marketId: string }) {
    const policy = {
      warningThreshold: input.warningThreshold,
      suspendThreshold: input.suspendThreshold,
      blockThreshold: input.blockThreshold,
      suspensionHours: input.suspensionHours,
    };
    this.policies.set(input.marketId, policy);
    return policy;
  }
  async history(input: {
    marketId: string;
    companyId?: string;
    userId?: string;
  }) {
    const match = (item: { companyId?: string; userId?: string }) =>
      (input.companyId && item.companyId === input.companyId) ||
      (input.userId && item.userId === input.userId);
    return {
      flags: this.flags.filter(
        (flag) => flag.marketId === input.marketId && match(flag),
      ),
      sanctions: this.sanctions.filter(match),
    };
  }
}

export const emptyModerationRepository = new InMemoryModerationRepository();

export function sanctionKind(count: number, policy: ModerationPolicy) {
  if (count >= policy.blockThreshold) return "BLOCK" as const;
  if (count >= policy.suspendThreshold) return "SUSPENSION" as const;
  if (count >= policy.warningThreshold) return "WARNING" as const;
  return undefined;
}
