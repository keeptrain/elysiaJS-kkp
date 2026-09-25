import { randomUUIDv7 } from 'bun';
import { eq, inArray } from 'drizzle-orm';
import { users } from '@/db/auth-schema';
import { organizations, products } from '@/db/schema';
import { db } from '@/lib/pg-db';
import { slugify } from '@/modules/products/utils';

const productTemplates = [
  {
    type: 'benih' as const,
    name: 'Benih Ikan Nila',
    slug: 'benih-ikan-nila',
    sku: 'BENIH-IKAN-NILA',
    stockAssitance: 25000,
    priceAssitance: 125,
    stockCommercial: 15000,
    priceCommercial: 175,
  },
  {
    type: 'benih' as const,
    name: 'Benih Ikan Lele',
    slug: 'benih-ikan-lele',
    sku: 'BENIH-IKAN-LELE',
    stockAssitance: 30000,
    priceAssitance: 110,
    stockCommercial: 18000,
    priceCommercial: 160,
  },
  {
    type: 'bibit' as const,
    name: 'Bibit Ikan Gurame',
    slug: 'bibit-ikan-gurame',
    sku: 'BIBIT-IKAN-GURAME',
    stockAssitance: 20000,
    priceAssitance: 140,
    stockCommercial: 12000,
    priceCommercial: 195,
  },
  {
    type: 'bibit' as const,
    name: 'Bibit Ikan Patin',
    slug: 'bibit-ikan-patin',
    sku: 'BIBIT-IKAN-PATIN',
    stockAssitance: 22000,
    priceAssitance: 135,
    stockCommercial: 14000,
    priceCommercial: 185,
  },
] as const;

export async function productsSeeder() {
  const organizationRows = await db
    .select({ id: organizations.id, code: organizations.code })
    .from(organizations)
    .where(eq(organizations.id, 1));
  const [creator] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'remajamesjid1945@gmail.com'))
    .limit(1);

  if (!creator) {
    throw new Error(
      'Cannot seed products: remajamesjid1945@gmail.com does not exist'
    );
  }

  const values = organizationRows.flatMap((organization, organizationIndex) =>
    productTemplates.map((template, productIndex) => {
      const organizationFactor = organizationIndex + 1;
      const productFactor = productIndex + 1;

      return {
        id: randomUUIDv7(),
        type: template.type,
        name: template.name,
        slug: `${slugify(organization.code)}-${template.slug}`,
        sku: `${organization.code}-${template.sku}`,
        status: 'active' as const,
        // All stock values are stored in grams.
        stockAssitance: template.stockAssitance + organizationFactor * 1000,
        priceAssitance:
          template.priceAssitance + organizationFactor * productFactor * 5,
        stockCommercial: template.stockCommercial + organizationFactor * 750,
        priceCommercial:
          template.priceCommercial + organizationFactor * productFactor * 7.5,
        organizationId: organization.id,
        createdBy: creator.id,
      };
    })
  );

  const existingSkus = new Set(
    values.length > 0
      ? (
          await db
            .select({ sku: products.sku })
            .from(products)
            .where(
              inArray(
                products.sku,
                values.map((value) => value.sku)
              )
            )
        ).map((product) => product.sku)
      : []
  );
  const newValues = values.filter((value) => !existingSkus.has(value.sku));

  if (newValues.length > 0) await db.insert(products).values(newValues);

  return newValues.length;
}

if (import.meta.main) {
  try {
    const count = await productsSeeder();
    console.log(`✅ Inserted ${count} products.`);
  } catch (error) {
    console.error('❌ Product seeding failed:', error);
    process.exitCode = 1;
  }
}
