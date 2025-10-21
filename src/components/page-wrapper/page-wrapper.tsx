const PageWrapper = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="pt-[7vh] px-[1vh] bg-stone-700 min-h-screen min-w-screen max-w-screen">
            {children}
        </div>
    )
}

export default PageWrapper;