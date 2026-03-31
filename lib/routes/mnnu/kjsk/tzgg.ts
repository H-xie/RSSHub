import { load } from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

type RawListItem = {
    title: string;
    link: string | undefined;
    pubDate: Date | undefined;
};

type ListItem = RawListItem & {
    link: string;
};

const isListItem = (item: RawListItem): item is ListItem => item.title.trim().length > 0 && typeof item.link === 'string';

export const handler: Route['handler'] = async (ctx) => {
    const limitQuery = ctx.req.query('limit');
    const limit = limitQuery ? Number.parseInt(limitQuery, 10) : 20;

    const rootUrl = 'https://kjsk.mnnu.edu.cn';
    const currentUrl = `${rootUrl}/kyxm/zxxm/zkxm/tzgg.htm`;

    const { data: response } = await got(currentUrl);
    const $ = load(response);

    const list = $('.listcolumn-con .news-item')
        .slice(0, limit)
        .toArray()
        .map((item): RawListItem => {
            const element = $(item);
            const links = element.find('.news-item-title a');
            const a = links.last().length ? links.last() : links.first();
            const href = a.attr('href');
            const dateText = element.find('.news-item-date').first().text().trim();

            return {
                title: (a.attr('title') || a.text()).trim(),
                link: href ? new URL(href, currentUrl).href : undefined,
                pubDate: dateText ? timezone(parseDate(dateText, 'YYYY-MM-DD'), +8) : undefined,
            };
        })
        .filter(isListItem)
        .filter((item, index, array) => array.findIndex((entry) => entry.link === item.link) === index);

    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link, async () => {
                const { data: detailResponse } = await got(item.link);
                const $$ = load(detailResponse);

                $$('script, style, .cd-top').remove();

                const title = $$('div.chapter-title').first().text().trim() || item.title;
                const infoText = $$('div.chapter-info').first().text().trim();
                const pubDateText = infoText.replace(/^发布时间[:：]\s*/, '');
                const description = $$('div#vsb_content').first().html() || $$('div.wp_articlecontent').first().html() || undefined;
                const contentText = $$('div#vsb_content').first().text().trim() || $$('div.wp_articlecontent').first().text().trim();

                return {
                    ...item,
                    title,
                    pubDate: pubDateText ? timezone(parseDate(pubDateText, 'YYYY-MM-DD'), +8) : item.pubDate,
                    description,
                    content: {
                        html: description ?? '',
                        text: contentText,
                    },
                };
            })
        )
    );

    return {
        title: '闽南师范大学科研处 - 自科项目通知公告',
        description: '闽南师范大学科研处自科项目通知公告',
        link: currentUrl,
        item: items,
    };
};

export const route: Route = {
    path: '/kjsk/tzgg',
    categories: ['university'],
    example: '/mnnu/kjsk/tzgg',
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
            source: ['kjsk.mnnu.edu.cn/kyxm/zxxm/zkxm/tzgg.htm'],
            target: '/kjsk/tzgg',
        },
    ],
    name: '科研处自科项目通知公告',
    maintainers: ['ZZZ'],
    handler,
    url: 'kjsk.mnnu.edu.cn',
};
