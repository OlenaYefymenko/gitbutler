import { invoke } from '$lib/ipc';
import { Branch } from './types';
import { stores } from '$lib';
import { writable, type Loadable, Value } from 'svelte-loadable-store';
import { plainToInstance } from 'class-transformer';
import type { Subscriber, Unsubscriber } from '@square/svelte-store';

const cache: Map<string, VirtualBranchStore> = new Map();

export interface VirtualBranchStore {
	subscribe: (branches: Subscriber<Loadable<Branch[]>>) => Unsubscriber;
	refresh: () => void;
}

export function getStore(projectId: string): VirtualBranchStore {
	const cachedStore = cache.get(projectId);
	if (cachedStore) {
		return cachedStore;
	}

	const writeable = createWriteable(projectId);
	const store: VirtualBranchStore = {
		subscribe: writeable.subscribe,
		refresh: () =>
			list(projectId).then((newBranches) => writeable.set({ isLoading: false, value: newBranches }))
	};
	cache.set(projectId, store);
	return store;
}

function createWriteable(projectId: string) {
	// Subscribe to sessions,  grab the last one and subscribe to deltas on it.
	// When a delta comes in, refresh the list of virtual branches.
	return writable(list(projectId), (set) => {
		const sessionsUnsubscribe = stores.sessions({ projectId }).subscribe((sessions) => {
			if (sessions.isLoading) return;
			if (Value.isError(sessions.value)) return;
			const lastSession = sessions.value.at(0);
			if (!lastSession) return;
			const deltasUnsubscribe = stores
				.deltas({ projectId, sessionId: lastSession.id })
				.subscribe(() => {
					list(projectId).then((newBranches) => {
						set(sort(plainToInstance(Branch, newBranches)));
					});
					return () => deltasUnsubscribe();
				});
			return () => sessionsUnsubscribe();
		});
	});
}

function sort(branches: Branch[]): Branch[] {
	for (const branch of branches) {
		for (const file of branch.files) {
			file.hunks.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
		}
	}
	return branches;
}

async function list(projectId: string): Promise<Branch[]> {
	return invoke<Array<Branch>>('list_virtual_branches', { projectId }).then((result) =>
		sort(plainToInstance(Branch, result))
	);
}