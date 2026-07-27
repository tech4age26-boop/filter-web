/** Workshop Expenses Log UI copy — keyed by portal locale (`en` | `ar`). */
const EXP_LOG_I18N = {
    en: {
        'title': 'Expenses',
        'subtitle': 'Approved petty-cash expense requests across all users and branches.',
        'label.branch': 'Branch',
        'label.user': 'User',
        'label.from': 'From',
        'label.to': 'To',
        'label.search': 'Search',
        'opt.allBranches': 'All branches',
        'opt.allUsers': 'All users',
        'search.placeholder': 'Category / description…',
        'btn.apply': 'Apply',
        'btn.refresh': 'Refresh',
        'stat.totalApproved': 'Total Approved',
        'stat.rowsMeta': '{shown} of {total} rows',
        'header.loading': 'Loading…',
        'header.entries': '{n} entries',
        'th.date': 'Date',
        'th.amount': 'Amount',
        'th.category': 'Category',
        'th.user': 'User',
        'th.branch': 'Branch',
        'th.approvedBy': 'Approved by',
        'th.description': 'Description',
        'empty': 'No expenses found.',
        'err.load': 'Could not load expenses.',
    },
    ar: {
        'title': 'المصروفات',
        'subtitle': 'طلبات مصروفات النثرية المعتمدة عبر جميع المستخدمين والفروع.',
        'label.branch': 'الفرع',
        'label.user': 'المستخدم',
        'label.from': 'من',
        'label.to': 'إلى',
        'label.search': 'بحث',
        'opt.allBranches': 'كل الفروع',
        'opt.allUsers': 'كل المستخدمين',
        'search.placeholder': 'الفئة / الوصف…',
        'btn.apply': 'تطبيق',
        'btn.refresh': 'تحديث',
        'stat.totalApproved': 'إجمالي المعتمد',
        'stat.rowsMeta': '{shown} من {total} صفوف',
        'header.loading': 'جارٍ التحميل…',
        'header.entries': '{n} قيود',
        'th.date': 'التاريخ',
        'th.amount': 'المبلغ',
        'th.category': 'الفئة',
        'th.user': 'المستخدم',
        'th.branch': 'الفرع',
        'th.approvedBy': 'اعتمد بواسطة',
        'th.description': 'الوصف',
        'empty': 'لا مصروفات.',
        'err.load': 'تعذّر تحميل المصروفات.',
    },
};

export function expLogT(locale, key, vars) {
    const pack = EXP_LOG_I18N[locale] || EXP_LOG_I18N.en;
    let text = pack[key] ?? EXP_LOG_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
