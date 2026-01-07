/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
   const { discount = 0, sale_price, quantity } = purchase;

    // Проверка обязательных полей
    if (sale_price == null || quantity == null) {
        throw new Error('Некорректные данные покупки: отсутствуют sale_price или quantity');
    }
    if (sale_price < 0 || quantity <= 0) {
        throw new Error('Цена или количество некорректны');
    }
    if (discount < 0 || discount > 100) {
        throw new Error('Скидка должна быть от 0 до 100%');
    }

    const decimalDiscount = discount / 100;
    const fullPrice = sale_price * quantity;
    const revenueWithDiscount = fullPrice * (1 - decimalDiscount);

    return revenueWithDiscount;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    if (total <= 0) return 0;
    if (index < 0 || index >= total) return 0;

    const { profit } = seller;

    if (profit <= 0) return 0;

    if (index === 0) {
        return Math.round(profit * 0.15 * 100) / 100; // 15%
    } else if (index === 1 || index === 2) {
        return Math.round(profit * 0.10 * 100) / 100; // 10%
    } else if (index === total - 1) {
        return 0; // Последний — без бонуса
    } else {
        return Math.round(profit * 0.05 * 100) / 100; // 5%
    }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // @TODO: Проверка входных данных
    if (!data) throw new Error('Данные не предоставлены');
    if (typeof data !== 'object') throw new Error('data должен быть объектом');


    const requiredKeys = ['sellers', 'products', 'purchase_records'];
    for (const key of requiredKeys) {
        if (!data[key] || !Array.isArray(data[key])) {
            throw new Error(`data.${key} должен быть непустым массивом`);
        }
    }
    
    // @TODO: Проверка наличия опций
    const calculateRevenue = options.calculateRevenue || calculateSimpleRevenue;
    const calculateBonus = options.calculateBonus || calculateBonusByProfit;

    // @TODO: Подготовка промежуточных данных для сбора статистики
    const sellerIndex = {}; // для быстрого доступа по seller_id
    const productIndex = {}; // для быстрого доступа по sku
    const sellerStats = [];  // итоговая статистика по продавцам

    // @TODO: Индексация продавцов и товаров для быстрого доступа
    data.sellers.forEach(seller => {
        sellerIndex[seller.id] = {
            ...seller,
            sales_count: 0,
            revenue: 0,
            profit: 0,
            products_sold: {} // { sku: количество }
        };
        sellerStats.push(sellerIndex[seller.id]);
    });

    // Индексация товаров
    data.products.forEach(product => {
        productIndex[product.sku] = product;
    });

    // @TODO: Расчет выручки и прибыли для каждого продавца
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) {
            console.warn(`Продавец с id ${record.seller_id} не найден`);
            return;
        }

        // Увеличиваем количество продаж
        seller.sales_count += 1;

        // Добавляем выручку (без учёта скидок на уровне записи)
        seller.revenue += record.total_amount - record.total_discount;

        // Расчёт прибыли по каждому товару в чеке
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            if (!product) {
                console.warn(`Товар с sku ${item.sku} не найден`);
                return;
            }

            // Себестоимость
            const cost = product.purchase_price * item.quantity;
            // Выручка с учётом скидки (через функцию)
            const itemRevenue = calculateRevenue(item, product);
            // Прибыль: выручка − себестоимость
            seller.profit += (itemRevenue - cost);

            // Учёт проданных количеств
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // @TODO: Сортировка продавцов по прибыли
    sellerStats.sort((a, b) => b.profit - a.profit);

    // @TODO: Назначение премий на основе ранжирования
    sellerStats.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, sellerStats.length, seller);

        // Формирование топ-10 проданных товаров
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });

    // @TODO: Подготовка итоговой коллекции с нужными полями
    return sellerStats.map(seller => ({
        seller_id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: parseFloat(seller.revenue.toFixed(2)),
        profit: parseFloat(seller.profit.toFixed(2)),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: parseFloat(seller.bonus.toFixed(2))
    }));
}
