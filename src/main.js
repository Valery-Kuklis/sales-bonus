/**
 * Функция для расчёта выручки
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
 * Функция для расчёта бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    if (total <= 0 || index < 0 || index >= total) return 0;

    const { profit } = seller;

    if (profit <= 0) return 0;

    if (index === 0) {
        return profit * 0.15; // 15%
    } else if (index === 1 || index === 2) {
        return profit * 0.10; // 10%
    } else if (index === total - 1) {
        return 0; // Последний — без бонуса
    } else {
        return profit * 0.05; // 5%
    }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {

    // Валидация входных данных
    if (!data || typeof data !== 'object') {
        throw new Error('data должен быть непустым объектом');
    }

    const requiredKeys = ['sellers', 'products', 'purchase_records'];
    for (const key of requiredKeys) {
        if (!Array.isArray(data[key]) || data[key].length === 0) {
            throw new Error(`data.${key} должен быть непустым массивом`);
        }
    }

    // Проверка опций
    const calculateRevenue = typeof options?.calculateRevenue === 'function'
        ? options.calculateRevenue
        : calculateSimpleRevenue;
    const calculateBonus = typeof options?.calculateBonus === 'function'
        ? options.calculateBonus
        : calculateBonusByProfit;

    // Индексация
    const sellerIndex = Object.fromEntries(
        data.sellers.map(seller => [
            seller.id,
            {
                ...seller,
                sales_count: 0,
                revenue: 0,
                profit: 0,
                products_sold: {}
            }
        ])
    );

    const productIndex = Object.fromEntries(
        data.products.map(product => [product.sku, product])
    );

    // Расчёт статистики
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) {
            console.warn(`Продавец с id ${record.seller_id} не найден`);
            return;
        }

        seller.sales_count += 1;

        const total_amount = record.total_amount ?? 0;
        const total_discount = record.total_discount ?? 0;
        seller.revenue += total_amount - total_discount;

        record.items.forEach(item => {
            const product = productIndex[item.sku];
            if (!product) {
                console.warn(`Товар с sku ${item.sku} не найден`);
                return;
            }

            const purchase_price = product.purchase_price ?? 0;
            const cost = purchase_price * item.quantity;
            const itemRevenue = calculateRevenue(item, product);
            seller.profit += itemRevenue - cost;

            seller.products_sold[item.sku] = (seller.products_sold[item.sku] || 0) + item.quantity;
        });
    });

    // Формирование результата
    const sellerStats = Object.values(sellerIndex)
        .sort((a, b) => b.profit - a.profit);

    sellerStats.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, sellerStats.length, seller);
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });

    return sellerStats.map(seller => ({
        seller_id: seller.id,
        name: `${seller.first_name || ''} ${seller.last_name || ''}`.trim(),
        revenue: parseFloat(seller.revenue.toFixed(2)),
        profit: parseFloat(seller.profit.toFixed(2)),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: parseFloat(seller.bonus.toFixed(2))
    }));
}
