import { faker, fakerUK, fakerDE } from "@faker-js/faker"
import type { Client } from "@/types"

export function generateClients(): Client[] {
  const clients: Client[] = []

  for (let i = 0; i < 30; i++) {
    const firstName = fakerUK.person.firstName()
    const lastName = fakerUK.person.lastName()
    clients.push({
      id: `client-uk-${i + 1}`,
      firstName,
      lastName,
      email: faker.internet.email({ firstName, lastName, provider: "gmail.com" }).toLowerCase(),
      phone: fakerUK.phone.number(),
      nationality: "UA",
      birthDate: faker.date.birthdate({ min: 25, max: 70, mode: "age" }),
      createdAt: faker.date.past({ years: 2 }),
    })
  }

  for (let i = 0; i < 20; i++) {
    const firstName = fakerDE.person.firstName()
    const lastName = fakerDE.person.lastName()
    clients.push({
      id: `client-de-${i + 1}`,
      firstName,
      lastName,
      email: faker.internet.email({ firstName, lastName, provider: "gmx.de" }).toLowerCase(),
      phone: fakerDE.phone.number(),
      nationality: "DE",
      birthDate: faker.date.birthdate({ min: 25, max: 70, mode: "age" }),
      createdAt: faker.date.past({ years: 2 }),
    })
  }

  return clients
}
