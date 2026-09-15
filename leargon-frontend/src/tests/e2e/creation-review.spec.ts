import { test, expect } from '@playwright/test';
import {
  uid,
  createDomain,
  createBoundedContextOwnedBy,
  createEntityInContext,
  apiGet,
  apiStatus,
  REALM_OWNER,
  REALM_OWNER_USERNAME,
  VIEWER,
} from './api-setup';

interface TaskListBody {
  tasks: Array<{ ruleCode: string; resourceKey: string; creationReview?: { recordId: number } }>;
}

/**
 * The owner of a bounded context is made aware of items someone else creates there: a "Review a new item
 * created in your area" to-do appears on their list and is closed by acknowledging it. Nobody else may
 * acknowledge it.
 */
test.describe('Review of items created in my realm', () => {
  test.use({ storageState: REALM_OWNER });

  test('the context owner sees the review and acknowledges it', async ({ page }) => {
    const domain = (await createDomain(uid('PW Review Domain'))) as { key: string };
    const bc = (await createBoundedContextOwnedBy(domain.key, uid('PW Review Context'), REALM_OWNER_USERNAME)) as { key: string };
    const entityName = uid('PW Reviewed Entity');
    const entity = (await createEntityInContext(entityName, bc.key)) as { key: string };

    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');

    const row = page.getByRole('listitem').filter({ hasText: entityName }).filter({ hasText: 'Review a new item created in your area' });
    await expect(row).toBeVisible({ timeout: 10_000 });

    await row.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Acknowledge' }).click();
    await expect(row).not.toBeVisible({ timeout: 10_000 });

    // Negative: the review is gone for good, and nobody else could have closed it.
    const tasks = await apiGet<TaskListBody>('/tasks', REALM_OWNER);
    expect(tasks.tasks.some((t) => t.resourceKey === entity.key && t.ruleCode === 'REVIEW_REALM_CREATION')).toBe(false);
  });

  test('a stranger cannot acknowledge someone else’s review (403)', async () => {
    const domain = (await createDomain(uid('PW Review Domain 2'))) as { key: string };
    const bc = (await createBoundedContextOwnedBy(domain.key, uid('PW Review Context 2'), REALM_OWNER_USERNAME)) as { key: string };
    const entity = (await createEntityInContext(uid('PW Reviewed Entity 2'), bc.key)) as { key: string };

    const tasks = await apiGet<TaskListBody>('/tasks', REALM_OWNER);
    const review = tasks.tasks.find((t) => t.resourceKey === entity.key && t.ruleCode === 'REVIEW_REALM_CREATION');
    expect(review?.creationReview?.recordId).toBeDefined();

    expect(await apiStatus(`/creation/reviews/${review!.creationReview!.recordId}/acknowledge`, 'POST', undefined, VIEWER)).toBe(403);
  });
});
