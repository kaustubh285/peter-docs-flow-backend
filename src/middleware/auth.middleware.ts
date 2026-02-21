import { Context, Next } from 'hono'
import jwt from 'jsonwebtoken'

interface JWTPayload {
  userId: string
  email: string
  role: string
  iat?: number
  exp?: number
}

declare module 'hono' {
  interface ContextVariableMap {
    user: JWTPayload
  }
}

export const authGuard = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'No token provided' }, 401)
    }

    const token = authHeader.substring(7)
    const jwtSecret = process.env.JWT_SECRET!
    
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload
    
    c.set('user', decoded)
    await next()
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401)
  }
}

export const advisorOnly = async (c: Context, next: Next) => {
  const user = c.get('user')
  
  if (user?.role !== 'advisor') {
    return c.json({ error: 'Advisor access required' }, 403)
  }

  await next()
}

export const customerOnly = async (c: Context, next: Next) => {
  const user = c.get('user')
  
  if (user?.role !== 'customer') {
    return c.json({ error: 'Customer access required' }, 403)
  }

  await next()
}
