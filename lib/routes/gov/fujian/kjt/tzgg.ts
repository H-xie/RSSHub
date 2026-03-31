import { load } from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const handler = async (ctx) => {
    const limit = ctx.req.query('limit') ? Number.parseInt(ctx.req.query('limit'), 10) : 20;

    const rootUrl = 'https://kjt.fujian.gov.cn';
    const currentUrl = `${rootUrl}/xxgk/tzgg/`;

    const { data: response } = await got(currentUrl);
    const $ = load(response);

    const list = $('div.list_base.list_base_date_01 ul li')
        .slice(0, limit)
        .toArray()
        .map((item) => {
            const element = $(item);

            const a = element.find('a').first();
            const href = a.prop('href');

            return {
                title: a.prop('title') ?? a.text(),
                link: href ? new URL(href, currentUrl).href : undefined,
                pubDate: timezone(parseDate(element.find('span.bf-pass').first().text(), 'YYYY-MM-DD'), +8),
            };
        })
        .filter((item): item is { title: string; link: string; pubDate: Date } => Boolean(item.title && item.link))
        .filter((item, index, array) => array.findIndex((entry) => entry.link === item.link) === index);

    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link, async () => {
                const { data: detailResponse } = await got(item.link);
                const $$ = load(detailResponse);

                $$('.article_qrcode_area, .article_btn_group, script, style').remove();

                const metaTitle = $$('meta[name="ArticleTitle"]').prop('content');
                const metaPubDate = $$('meta[name="PubDate"]').prop('content');
                const metaSource = $$('meta[name="ContentSource"]').prop('content');
                const metaColumnName = $$('meta[name="ColumnName"]').prop('content');
                const metaColumnType = $$('meta[name="ColumnType"]').prop('content');

                const timeText = $$('span.article_time').first().text().replace(/^\s*时间[:：]\s*/, '');
                const sourceText = $$('span.article_source').first().text().replace(/^\s*来源[:：]\s*/, '');

                const description = $$('div.article_area').first().html() || $$('div.TRS_Editor').first().html() || undefined;

                return {
                    ...item,
                    title: metaTitle || item.title,
                    pubDate: metaPubDate || timeText ? timezone(parseDate(metaPubDate || timeText), +8) : item.pubDate,
                    author: metaSource || sourceText || undefined,
                    category: [...new Set([metaColumnName, metaColumnType].filter(Boolean))],
                    description,
                    content: {
                        html: description ?? '',
                        text: $$('div.TRS_Editor').first().text(),
                    },
                };
            })
        )
    );

    return {
        title: '福建省科学技术厅 - 通知公告',
        description: '福建省科学技术厅通知公告',
        link: currentUrl,
        item: items,
    };
};

export const route: Route = {
    path: '/fujian/kjt/tzgg',
    categories: ['government'],
    example: '/gov/fujian/kjt/tzgg',
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportRadar: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['kjt.fujian.gov.cn/xxgk/tzgg/:id*', 'kjt.fujian.gov.cn/xxgk/tzgg/'],
            target: '/fujian/kjt/tzgg',
        },
    ],
    name: '通知公告',
    maintainers: ['nczitzk'],
    handler,
    url: 'kjt.fujian.gov.cn',
};
