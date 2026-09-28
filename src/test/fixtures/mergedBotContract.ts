/** Synthetic contract projections, never production data.
 * Bot 741feec565f9c7046ab73566d61f4a9d7fdf68f4:
 * app/cabinet/schemas/users.py, app/cabinet/routes/gift.py (get_sent_gifts),
 * app/services/gift_claim_service.py and app/utils/gift_links.py.
 */
export const mergedBotContract = {
  user: { id: 7, remnawave_id: 47 },
  unlinkedUser: { id: 7, remnawave_id: null },
  syncStatus: { user_id: 7, remnawave_id: 47, subscription_id: 19 },
  syncFrom: { success: true, message: 'Synced', panel_user: { id: 47 }, changes: {}, errors: [] },
  syncTo: { success: true, message: 'Synced', panel_user_id: 47, changes: {}, errors: [] },
  gift: {
    token: 'aB9_-xY2cD7e',
    gift_code: 'aB9_-xY2cD7e',
    bot_claim_url: 'https://t.me/ExampleBot?start=GIFT_aB9_-xY2cD7e',
    cabinet_claim_url: 'https://cab.example/gift?tab=activate&code=aB9_-xY2cD7e',
  },
};
