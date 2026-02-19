// src/features/library/FrameworkList.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { libraryApi } from '@/api/library'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, ExternalLink, BookOpen, FileText, CheckCircle } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

export function FrameworkList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data: frameworksData, isLoading } = useQuery({
    queryKey: ['frameworks'],
    queryFn: () => libraryApi.getFrameworks(),
  })

  const frameworks = frameworksData?.results || []

  const filteredFrameworks = frameworks.filter(fw =>
    fw.code.toLowerCase().includes(search.toLowerCase()) ||
    fw.name.toLowerCase().includes(search.toLowerCase()) ||
    fw.issuing_organization.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Framework Library</h1>
        <p className="text-gray-600 mt-1">
          Browse compliance frameworks and their requirements
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search frameworks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Frameworks</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{frameworks.length}</p>
              </div>
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Requirements</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {frameworks.reduce((sum, fw) => sum + fw.requirement_count, 0)}
                </p>
              </div>
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Frameworks</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {frameworks.filter(fw => fw.is_active).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Framework Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFrameworks.map((framework) => (
          <Card
            key={framework.id}
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate(`/library/frameworks/${framework.id}`)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{framework.code}</CardTitle>
                  <CardDescription className="mt-1">
                    {framework.name}
                  </CardDescription>
                </div>
                {framework.is_active && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Active
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Version */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Version</span>
                <span className="font-medium text-gray-900">{framework.version}</span>
              </div>

              {/* Issuing Organization */}
              {framework.issuing_organization && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Issued by</span>
                  <span className="font-medium text-gray-900 truncate ml-2">
                    {framework.issuing_organization}
                  </span>
                </div>
              )}

              {/* Requirements */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Requirements</span>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">
                    {framework.requirement_count}
                  </span>
                  <span className="text-gray-500">
                    ({framework.mandatory_requirement_count} mandatory)
                  </span>
                </div>
              </div>

              {/* Documentation Link */}
              {framework.documentation_url && (
                <a
                  href={framework.documentation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-sm text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Official Documentation
                </a>
              )}

              {/* View Details Button */}
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/library/frameworks/${framework.id}`)
                }}
              >
                View Details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No Results */}
      {filteredFrameworks.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No frameworks found matching your search.</p>
        </div>
      )}
    </div>
  )
}
