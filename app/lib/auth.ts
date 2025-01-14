import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { createDb, Db } from "./db"
import { accounts, sessions, users, roles, userRoles } from "./schema"
import { eq } from "drizzle-orm"
import { getRequestContext } from "@cloudflare/next-on-pages"
import { Permission, hasPermission, ROLES, Role } from "./permissions"
import CredentialsProvider from "next-auth/providers/credentials"
import { hashPassword, comparePassword } from "@/lib/utils"
import { authSchema } from "@/lib/validation"

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  [ROLES.EMPEROR]: "皇帝（网站所有者）",
  [ROLES.KNIGHT]: "骑士（高级用户）",
  [ROLES.CIVILIAN]: "平民（普通用户）",
}

const getDefaultRole = async (): Promise<Role> => {
  const defaultRole = await getRequestContext().env.SITE_CONFIG.get("DEFAULT_ROLE")
  return defaultRole === ROLES.KNIGHT ? ROLES.KNIGHT : ROLES.CIVILIAN
}

async function findOrCreateRole(db: Db, roleName: Role) {
  let role = await db.query.roles.findFirst({
    where: eq(roles.name, roleName),
  })

  if (!role) {
    const [newRole] = await db.insert(roles)
      .values({
        name: roleName,
        description: ROLE_DESCRIPTIONS[roleName],
      })
      .returning()
    role = newRole
  }

  return role
}

export async function assignRoleToUser(db: Db, userId: string, roleId: string) {
  await db.delete(userRoles)
    .where(eq(userRoles.userId, userId))

  await db.insert(userRoles)
    .values({
      userId,
      roleId,
    })
}

export async function checkPermission(permission: Permission) {
  const session = await auth()
  if (!session?.user?.id) return false

  const db = createDb()
  const userRoleRecords = await db.query.userRoles.findMany({
    where: eq(userRoles.userId, session.user.id),
    with: { role: true },
  })

  const userRoleNames = userRoleRecords.map(ur => ur.role.name)
  return hasPermission(userRoleNames as Role[], permission)
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut
} = NextAuth(() => ({
  secret: process.env.AUTH_SECRET,
  adapter: DrizzleAdapter(createDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
  }),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "用户名", type: "text", required: true },
        password: { label: "密码", type: "password", required: true }
      },
      async authorize(credentialDTO) {

          const parsedCredentials = authSchema.parse({
            username: credentialDTO.username,
            password: credentialDTO.password,
          })

          const db = createDb()
          const user = await db.query.users.findFirst({
            where: eq(users.username, parsedCredentials.username),
          })

          console.log('user', user)

          if (!user?.password) throw new Error("用户名或密码错误")

          const isValid = await comparePassword(parsedCredentials.password, user.password)
          if (!isValid) throw new Error("用户名或密码错误")

          return { ...user, password: undefined }
      }
    })
  ],
  events: {
    async signIn({ user }) {
      if (!user.id) return

      try {
        const db = createDb()
        const existingRole = await db.query.userRoles.findFirst({
          where: eq(userRoles.userId, user.id),
        })

        if (existingRole) return

        const defaultRole = await getDefaultRole()
        const role = await findOrCreateRole(db, defaultRole)
        await assignRoleToUser(db, user.id, role.id)
      } catch (error) {
        console.error('Error assigning role:', error)
      }
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  callbacks: {
    async session({ session, user }) {
      if (!session?.user) return session

      const db = createDb()
      let userRoleRecords = await db.query.userRoles.findMany({
        where: eq(userRoles.userId, user.id),
        with: { role: true },
      })

      if (!userRoleRecords.length) {
        const defaultRole = await getDefaultRole()
        const role = await findOrCreateRole(db, defaultRole)
        await assignRoleToUser(db, user.id, role.id)
        userRoleRecords = [{
          userId: user.id,
          roleId: role.id,
          createdAt: new Date(),
          role: role
        }]
      }

      session.user.roles = userRoleRecords.map(ur => ({
        name: ur.role.name,
      }))

      return session
    },
  }
}))

export async function register(username: string, password: string) {
  const db = createDb()
  
  const existing = await db.query.users.findFirst({
    where: eq(users.username, username)
  })

  if (existing) {
    throw new Error("用户名已存在")
  }

  const hashedPassword = await hashPassword(password)
  
  const [user] = await db.insert(users)
    .values({
      username,
      password: hashedPassword,
    })
    .returning()

  return user
}
