import { error, redirect } from '@sveltejs/kit';
import { format, compareDesc } from 'date-fns';
import type { PageLoad } from './$types';
import { getSessionStore } from '$lib/stores/sessions';
import { promisify } from 'svelte-loadable-store';

export const load: PageLoad = async ({ url, params }) => {
	const sessions = await promisify(getSessionStore({ projectId: params.projectId }));
	const latestDate = sessions
		.map((session) => session.meta.startTimestampMs)
		.sort(compareDesc)
		.shift();
	if (!latestDate) throw error(404, 'No sessions found');
	throw redirect(
		302,
		`/projects/${params.projectId}/player/${format(latestDate, 'yyyy-MM-dd')}/${url.search}`
	);
};
