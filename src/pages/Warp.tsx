import { useEffect, useState } from 'react'
import {
    AlertCircle,
    Globe,
    Link2,
    Loader2,
    Play,
    Plus,
    RefreshCw,
    Shield,
    Square,
    Trash2,
    Unplug,
} from 'lucide-react'
import { toast } from 'sonner'
import { accountsApi, warpApi } from '../api/client'
import type { AccountResponse, WarpInstanceResponse } from '../api/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

function formatDate(value?: string | null) {
    if (!value) {
        return '-'
    }

    return new Date(value).toLocaleString('zh-CN')
}

function shortId(value: string) {
    return `${value.slice(0, 8)}...`
}

function getStatusBadge(status: WarpInstanceResponse['status']) {
    switch (status) {
        case 'running':
            return (
                <Badge variant='default' className='bg-green-500'>
                    运行中
                </Badge>
            )
        case 'starting':
            return <Badge variant='secondary'>启动中</Badge>
        case 'stopped':
            return <Badge variant='outline'>已停止</Badge>
        case 'error':
            return <Badge variant='destructive'>异常</Badge>
        default:
            return <Badge variant='outline'>{status}</Badge>
    }
}

export function Warp() {
    const [instances, setInstances] = useState<WarpInstanceResponse[]>([])
    const [accounts, setAccounts] = useState<AccountResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [creating, setCreating] = useState(false)
    const [pendingActions, setPendingActions] = useState<Set<string>>(new Set())
    const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>({})

    const loadData = async (showRefreshing = false) => {
        if (showRefreshing) {
            setRefreshing(true)
        }

        try {
            const [instancesResponse, accountsResponse] = await Promise.all([warpApi.list(), accountsApi.list()])
            setInstances(instancesResponse.data)
            setAccounts(accountsResponse.data)
        } catch (error) {
            console.error('Failed to load WARP data:', error)
        } finally {
            setLoading(false)
            if (showRefreshing) {
                setRefreshing(false)
            }
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const setActionPending = (key: string, active: boolean) => {
        setPendingActions(prev => {
            const next = new Set(prev)
            if (active) {
                next.add(key)
            } else {
                next.delete(key)
            }
            return next
        })
    }

    const runAction = async (key: string, action: () => Promise<void>) => {
        setActionPending(key, true)
        try {
            await action()
            await loadData()
        } finally {
            setActionPending(key, false)
        }
    }

    const handleRegister = async () => {
        setCreating(true)
        try {
            await warpApi.register()
            toast.success('新的 WARP IP 已创建')
            await loadData()
        } catch (error) {
            console.error('Failed to register WARP instance:', error)
        } finally {
            setCreating(false)
        }
    }

    const runningCount = instances.filter(instance => instance.status === 'running').length
    const availableIpCount = instances.filter(instance => Boolean(instance.public_ip)).length

    if (loading) {
        return (
            <div className='space-y-6'>
                <div className='space-y-2'>
                    <Skeleton className='h-8 w-40' />
                    <Skeleton className='h-4 w-80' />
                </div>
                <div className='grid gap-4 md:grid-cols-3'>
                    {[...Array(3)].map((_, index) => (
                        <Card key={index}>
                            <CardHeader>
                                <Skeleton className='h-5 w-24' />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className='h-8 w-16' />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <div className='grid gap-4 xl:grid-cols-2'>
                    {[...Array(2)].map((_, index) => (
                        <Card key={index}>
                            <CardHeader>
                                <Skeleton className='h-6 w-48' />
                                <Skeleton className='h-4 w-56' />
                            </CardHeader>
                            <CardContent className='space-y-4'>
                                <Skeleton className='h-24 w-full' />
                                <Skeleton className='h-10 w-full' />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className='space-y-6'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
                <div>
                    <h1 className='text-3xl font-bold tracking-tight pb-1'>WARP IP</h1>
                    <p className='text-muted-foreground'>在 Web 中创建独立的 Cloudflare WARP 出口 IP，并绑定到 Claude 账户。</p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <Button variant='outline' onClick={() => loadData(true)} disabled={refreshing}>
                        {refreshing ? <Loader2 className='h-4 w-4 animate-spin' /> : <RefreshCw className='h-4 w-4' />}
                        刷新
                    </Button>
                    <Button onClick={handleRegister} disabled={creating}>
                        {creating ? <Loader2 className='h-4 w-4 animate-spin' /> : <Plus className='h-4 w-4' />}
                        一键创建 IP
                    </Button>
                </div>
            </div>

            {accounts.length === 0 && (
                <Alert>
                    <AlertCircle className='h-4 w-4' />
                    <AlertDescription>当前还没有 Claude 账户。你可以先创建 WARP IP，稍后再到此页面绑定账户。</AlertDescription>
                </Alert>
            )}

            <div className='grid gap-4 md:grid-cols-3'>
                <Card>
                    <CardHeader>
                        <CardDescription>实例总数</CardDescription>
                        <CardTitle className='text-3xl'>{instances.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader>
                        <CardDescription>运行中的代理</CardDescription>
                        <CardTitle className='text-3xl'>{runningCount}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader>
                        <CardDescription>已拿到公网 IP</CardDescription>
                        <CardTitle className='text-3xl'>{availableIpCount}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {instances.length === 0 ? (
                <Card className='border-dashed'>
                    <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
                        <div className='rounded-full bg-primary/10 p-4'>
                            <Shield className='h-8 w-8 text-primary' />
                        </div>
                        <div className='space-y-1'>
                            <h2 className='text-xl font-semibold'>还没有 WARP 实例</h2>
                            <p className='text-sm text-muted-foreground'>点击上方的“一键创建 IP”后，Clove 会自动注册、启动并探测公网出口 IP。</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className='grid gap-4 xl:grid-cols-2'>
                    {instances.map(instance => {
                        const boundAccounts = accounts.filter(account => account.proxy_url === instance.proxy_url)
                        const selectedAccount =
                            selectedAccounts[instance.instance_id] || boundAccounts[0]?.organization_uuid
                        const startKey = `start:${instance.instance_id}`
                        const stopKey = `stop:${instance.instance_id}`
                        const deleteKey = `delete:${instance.instance_id}`
                        const bindKey = `bind:${instance.instance_id}`

                        return (
                            <Card key={instance.instance_id} className='gap-4'>
                                <CardHeader className='space-y-4'>
                                    <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                                        <div className='space-y-2'>
                                            <CardTitle className='flex items-center gap-2'>
                                                <Shield className='h-5 w-5 text-primary' />
                                                {instance.instance_id}
                                            </CardTitle>
                                            <CardDescription>独立 WARP 代理实例，可分配给一个或多个 Claude 账户。</CardDescription>
                                        </div>
                                        {getStatusBadge(instance.status)}
                                    </div>

                                    <div className='grid gap-3 sm:grid-cols-2'>
                                        <div className='rounded-lg border bg-muted/30 p-3'>
                                            <div className='mb-1 flex items-center gap-2 text-sm text-muted-foreground'>
                                                <Globe className='h-4 w-4' />
                                                公网 IP
                                            </div>
                                            <div className='font-mono text-sm'>{instance.public_ip || '待探测'}</div>
                                        </div>
                                        <div className='rounded-lg border bg-muted/30 p-3'>
                                            <div className='mb-1 flex items-center gap-2 text-sm text-muted-foreground'>
                                                <Link2 className='h-4 w-4' />
                                                代理地址
                                            </div>
                                            <div className='font-mono text-sm break-all'>{instance.proxy_url}</div>
                                        </div>
                                        <div className='rounded-lg border bg-muted/30 p-3'>
                                            <div className='mb-1 text-sm text-muted-foreground'>端口</div>
                                            <div className='font-mono text-sm'>{instance.port}</div>
                                        </div>
                                        <div className='rounded-lg border bg-muted/30 p-3'>
                                            <div className='mb-1 text-sm text-muted-foreground'>最近启动</div>
                                            <div className='text-sm'>{formatDate(instance.last_started_at)}</div>
                                        </div>
                                    </div>

                                    {instance.error_message && (
                                        <Alert variant='destructive'>
                                            <AlertCircle className='h-4 w-4' />
                                            <AlertDescription>{instance.error_message}</AlertDescription>
                                        </Alert>
                                    )}
                                </CardHeader>

                                <CardContent className='space-y-4'>
                                    <div className='flex flex-wrap gap-2'>
                                        {instance.status === 'running' ? (
                                            <Button
                                                variant='outline'
                                                onClick={() =>
                                                    runAction(stopKey, async () => {
                                                        await warpApi.stop(instance.instance_id)
                                                        toast.success(`${instance.instance_id} 已停止`)
                                                    })
                                                }
                                                disabled={pendingActions.has(stopKey)}
                                            >
                                                {pendingActions.has(stopKey) ? (
                                                    <Loader2 className='h-4 w-4 animate-spin' />
                                                ) : (
                                                    <Square className='h-4 w-4' />
                                                )}
                                                停止
                                            </Button>
                                        ) : (
                                            <Button
                                                variant='outline'
                                                onClick={() =>
                                                    runAction(startKey, async () => {
                                                        await warpApi.start(instance.instance_id)
                                                        toast.success(`${instance.instance_id} 已启动`)
                                                    })
                                                }
                                                disabled={pendingActions.has(startKey)}
                                            >
                                                {pendingActions.has(startKey) ? (
                                                    <Loader2 className='h-4 w-4 animate-spin' />
                                                ) : (
                                                    <Play className='h-4 w-4' />
                                                )}
                                                启动
                                            </Button>
                                        )}

                                        <Button
                                            variant='destructive'
                                            onClick={() =>
                                                runAction(deleteKey, async () => {
                                                    await warpApi.delete(instance.instance_id)
                                                    toast.success(`${instance.instance_id} 已删除`)
                                                })
                                            }
                                            disabled={pendingActions.has(deleteKey)}
                                        >
                                            {pendingActions.has(deleteKey) ? (
                                                <Loader2 className='h-4 w-4 animate-spin' />
                                            ) : (
                                                <Trash2 className='h-4 w-4' />
                                            )}
                                            删除
                                        </Button>
                                    </div>

                                    <Separator />

                                    <div className='space-y-3'>
                                        <Label>绑定到账户</Label>
                                        <div className='flex flex-col gap-2 sm:flex-row'>
                                            <Select
                                                value={selectedAccount || undefined}
                                                onValueChange={value =>
                                                    setSelectedAccounts(prev => ({
                                                        ...prev,
                                                        [instance.instance_id]: value,
                                                    }))
                                                }
                                            >
                                                <SelectTrigger className='w-full'>
                                                    <SelectValue placeholder='选择一个 Claude 账户' />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {accounts.map(account => (
                                                        <SelectItem key={account.organization_uuid} value={account.organization_uuid}>
                                                            {shortId(account.organization_uuid)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            <Button
                                                onClick={() => {
                                                    if (!selectedAccount) {
                                                        toast.error('请先选择要绑定的账户')
                                                        return
                                                    }

                                                    void runAction(bindKey, async () => {
                                                        await warpApi.bind(instance.instance_id, selectedAccount)
                                                        toast.success(`已将 ${instance.instance_id} 绑定到账户 ${shortId(selectedAccount)}`)
                                                    })
                                                }}
                                                disabled={instance.status !== 'running' || pendingActions.has(bindKey)}
                                            >
                                                {pendingActions.has(bindKey) ? (
                                                    <Loader2 className='h-4 w-4 animate-spin' />
                                                ) : (
                                                    <Link2 className='h-4 w-4' />
                                                )}
                                                绑定
                                            </Button>
                                        </div>

                                        <div className='space-y-2'>
                                            <div className='text-sm text-muted-foreground'>当前绑定</div>
                                            {boundAccounts.length === 0 ? (
                                                <p className='text-sm text-muted-foreground'>暂无绑定账户</p>
                                            ) : (
                                                <div className='flex flex-wrap gap-2'>
                                                    {boundAccounts.map(account => {
                                                        const unbindKey = `unbind:${account.organization_uuid}`
                                                        return (
                                                            <div
                                                                key={account.organization_uuid}
                                                                className='flex items-center gap-2 rounded-md border px-3 py-2 text-sm'
                                                            >
                                                                <span className='font-mono'>{shortId(account.organization_uuid)}</span>
                                                                <Button
                                                                    variant='ghost'
                                                                    size='sm'
                                                                    className='h-7 px-2'
                                                                    onClick={() =>
                                                                        runAction(unbindKey, async () => {
                                                                            await warpApi.unbind(account.organization_uuid)
                                                                            toast.success(`已解绑账户 ${shortId(account.organization_uuid)}`)
                                                                        })
                                                                    }
                                                                    disabled={pendingActions.has(unbindKey)}
                                                                >
                                                                    {pendingActions.has(unbindKey) ? (
                                                                        <Loader2 className='h-4 w-4 animate-spin' />
                                                                    ) : (
                                                                        <Unplug className='h-4 w-4' />
                                                                    )}
                                                                    解绑
                                                                </Button>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
