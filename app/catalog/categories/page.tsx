'use client'

import { useEffect, useState } from 'react'
import { supabase, ProductCategory } from '@/lib/supabase'
import { Plus, Edit2, Settings, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'

export default function CategoriesDashboardPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  async function fetchCategories() {
    try {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('product_categories')
        .select('*')
        .order('sort_order', { ascending: true })

      if (err) {
        setError(err.message)
      } else {
        setCategories(data || [])
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  async function toggleActiveStatus(category: ProductCategory) {
    try {
      const nextStatus = !category.is_active
      const { error: err } = await supabase
        .from('product_categories')
        .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', category.id)

      if (err) {
        alert('Failed to update status: ' + err.message)
      } else {
        setCategories(prev =>
          prev.map(c => (c.id === category.id ? { ...c, is_active: nextStatus } : c))
        )
      }
    } catch (e: any) {
      alert('Error updating status: ' + e.message)
    }
  }

  return (
    <div className="p-4 lg:p-7 max-w-6xl mx-auto">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-stone-500 text-xs mb-1.5 font-medium">
            <Link href="/catalog" className="hover:text-stone-700 transition-colors">Catalog</Link>
            <span>/</span>
            <span className="text-stone-700">Categories</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-stone-500" />
            Product Categories
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Manage your jewelry categories and define dynamic attribute schemas per category.
          </p>
        </div>

        <Link
          href="/catalog/categories/new"
          className="flex items-center gap-2 bg-stone-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-900 transition-all shadow-sm self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          Error: {error}
        </div>
      )}

      {loading ? (
        <div className="text-stone-400 text-sm py-12 text-center">Loading categories...</div>
      ) : categories.length === 0 ? (
        <div className="bg-stone-50 border-2 border-dashed border-stone-200 rounded-2xl p-12 text-center">
          <Settings className="w-8 h-8 text-stone-300 mx-auto mb-3" />
          <h3 className="font-semibold text-stone-800 text-base mb-1">No Categories</h3>
          <p className="text-stone-400 text-xs max-w-sm mx-auto mb-6">
            Create categories to organize products and define dynamic attribute fields.
          </p>
          <Link
            href="/catalog/categories/new"
            className="inline-flex items-center gap-2 bg-stone-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-900 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Category
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200">
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Slug</th>
                  <th className="px-5 py-3.5 text-center">Attributes</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {categories.map(cat => {
                  const schema = Array.isArray(cat.attribute_schema) ? cat.attribute_schema : []
                  return (
                    <tr key={cat.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-stone-900">{cat.name}</td>
                      <td className="px-5 py-4 text-stone-500 font-mono text-xs">{cat.slug}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          schema.length > 0
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-stone-100 text-stone-500'
                        }`}>
                          {schema.length} fields
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => toggleActiveStatus(cat)}
                          className="flex items-center gap-1.5 text-xs font-medium cursor-pointer focus:outline-none"
                        >
                          {cat.is_active ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                              <span className="text-green-700">Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-stone-300" />
                              <span className="text-stone-500">Inactive</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/catalog/categories/${cat.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-800 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/70 px-3 py-1.5 rounded-lg transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit Schema
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
