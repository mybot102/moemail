"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useToast } from "@/components/ui/use-toast"
import { Github } from "lucide-react"
import { z } from "zod"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authSchema } from "@/lib/validation"

interface FormErrors {
  username?: string
  password?: string
}

export function LoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const { toast } = useToast()

  const validateForm = (): boolean => {
    try {
      authSchema.parse({ username, password })
      setErrors({})
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: FormErrors = {}
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as keyof FormErrors] = err.message
          }
        })
        setErrors(newErrors)
      }
      return false
    }
  }

  const handleRegister = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      if (!res.ok) {
        const data = await res.json() as { error: string }
        throw new Error(data.error)
      }

      await signIn("credentials", {
        username,
        password,
        callbackUrl: "/moe",
      })
    } catch (error) {
      toast({
        title: "注册失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      const result = await signIn("credentials", {
        username,
        password,
        callbackUrl: "/moe",
      })

      if (result?.error) {
        throw new Error("用户名或密码错误")
      }
    } catch (error) {
      toast({
        title: "登录失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  return (
    <Card className="w-[90%] max-w-md">
      <CardHeader>
        <CardTitle>欢迎使用 MoeMail</CardTitle>
        <CardDescription>请登录或注册以继续</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="用户名"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setErrors({})
                }}
                disabled={loading}
              />
              {errors.username && (
                <p className="text-xs text-destructive">{errors.username}</p>
              )}
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setErrors({})
                }}
                disabled={loading}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleLogin}
              disabled={loading}
            >
              登录
            </Button>
          </TabsContent>
          <TabsContent value="register" className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="用户名"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setErrors({})
                }}
                disabled={loading}
              />
              {errors.username && (
                <p className="text-xs text-destructive">{errors.username}</p>
              )}
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setErrors({})
                }}
                disabled={loading}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleRegister}
              disabled={loading}
            >
              注册
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => signIn("github")}
        >
          <Github className="w-4 h-4" />
          使用 GitHub 登录
        </Button>
      </CardFooter>
    </Card>
  )
}